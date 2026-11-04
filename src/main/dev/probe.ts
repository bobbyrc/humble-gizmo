import { app, BrowserWindow, dialog, session } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkSignedIn, openSignInWindow, PARTITIONS } from '../windows/signIn'
import { decodeHtmlAttribute, steamIdFromLoginCookie } from './probeHelpers'

/**
 * Throwaway spike: finds out which transport and owned-games source work.
 * The report holds ONLY status codes, booleans, counts and top-level key names.
 * Never put a body, cookie, token, key or id into it.
 */
type Report = Record<string, unknown>

const HUMBLE = 'https://www.humblebundle.com'
const STORE = 'https://store.steampowered.com'
const COMMUNITY = 'https://steamcommunity.com'
const TEST_KEY = 'AAAAA-AAAAA-AAAAA'

const humbleSession = (): Electron.Session => session.fromPartition(PARTITIONS.humble)
const steamSession = (): Electron.Session => session.fromPartition(PARTITIONS.steam)

/** Runs one probe; a failure records only the error class name, never the message. */
async function step(name: string, report: Report, fn: () => Promise<Report>): Promise<void> {
  try {
    report[name] = await fn()
  } catch (e) {
    report[name] = { error: e instanceof Error ? e.name : 'unknown' }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function arrayLength(v: unknown): number | null {
  return Array.isArray(v) ? v.length : null
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

async function ensureSignedIn(service: 'humble' | 'steam'): Promise<boolean> {
  if (await checkSignedIn(service)) return true
  await openSignInWindow(service)
  return checkSignedIn(service)
}

async function probeHumble(report: Report): Promise<void> {
  let gamekeys: string[] = []
  await step('H1', report, async () => {
    const res = await humbleSession().fetch(`${HUMBLE}/api/v1/user/order`)
    const text = await res.text()
    const json = parseJson(text)
    if (Array.isArray(json)) {
      gamekeys = json
        .flatMap((o) => (isRecord(o) && typeof o.gamekey === 'string' ? [o.gamekey] : []))
        .slice(0, 3)
    }
    return {
      status: res.status,
      json: json !== undefined,
      arrayLength: arrayLength(json),
      cloudflare: text.includes('cf-chl') || text.includes('challenge-platform')
    }
  })

  await step('H1b', report, async () => {
    const [gamekey] = gamekeys
    if (!gamekey) return { skipped: true }
    const res = await humbleSession().fetch(
      `${HUMBLE}/api/v1/order/${encodeURIComponent(gamekey)}?all_tpkds=true`
    )
    const json = parseJson(await res.text())
    return { status: res.status, topLevelKeys: isRecord(json) ? Object.keys(json) : null }
  })

  await step('H1c', report, async () => {
    if (gamekeys.length < 2) return { skipped: true }
    const query = gamekeys.map((k) => `gamekeys=${encodeURIComponent(k)}`).join('&')
    const res = await humbleSession().fetch(`${HUMBLE}/api/v1/orders?all_tpkds=true&${query}`)
    const json = parseJson(await res.text())
    const keysInBody = new Set(isRecord(json) ? Object.keys(json) : [])
    const returned = gamekeys.filter((k) => keysInBody.has(k)).length
    return {
      status: res.status,
      isObject: isRecord(json),
      requested: gamekeys.length,
      returned,
      allPresent: returned === gamekeys.length
    }
  })

  await step('H2', report, async () => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        partition: PARTITIONS.humble,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    try {
      await win.loadURL(`${HUMBLE}/home/library`)
      const status: unknown = await win.webContents.executeJavaScript(
        "fetch('/api/v1/user/order').then(r=>r.status)"
      )
      return { status: typeof status === 'number' ? status : null }
    } finally {
      if (!win.isDestroyed()) win.destroy()
    }
  })
}

async function steamIdFromCookies(): Promise<string | null> {
  const cookies = await steamSession().cookies.get({ url: STORE, name: 'steamLoginSecure' })
  return cookies.length > 0 ? steamIdFromLoginCookie(cookies[0].value) : null
}

async function probeSteam(report: Report): Promise<void> {
  let steamId: string | null = null
  await step('steamId', report, async () => {
    steamId = await steamIdFromCookies()
    return { found: steamId !== null }
  })

  await step('S1', report, async () => {
    const res = await steamSession().fetch(`${STORE}/dynamicstore/userdata/`)
    const json = parseJson(await res.text())
    const data = isRecord(json) ? json : {}
    return {
      status: res.status,
      ownedApps: arrayLength(data.rgOwnedApps),
      ownedPackages: arrayLength(data.rgOwnedPackages)
    }
  })

  await step('S2', report, async () => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Continue', 'Skip'],
      defaultId: 1,
      cancelId: 1,
      message: `This test submits an invalid key (${TEST_KEY}) to Steam to confirm redemption works. It uses 1 of Steam's ~10 failed attempts per hour. Continue?`
    })
    if (response !== 0) return { skipped: true }
    const cookies = await steamSession().cookies.get({ url: STORE, name: 'sessionid' })
    if (cookies.length === 0) return { sessionCookie: false }
    const res = await steamSession().fetch(`${STORE}/account/ajaxregisterkey/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_key: TEST_KEY,
        sessionid: cookies[0].value
      }).toString()
    })
    const json = parseJson(await res.text())
    const data = isRecord(json) ? json : {}
    const details = data.purchase_result_details
    return {
      sessionCookie: true,
      status: res.status,
      success: typeof data.success === 'number' ? data.success : null,
      purchaseResultDetails: typeof details === 'number' ? details : null
    }
  })

  await step('N1', report, async () => {
    if (!steamId) return { skipped: true }
    const res = await steamSession().fetch(`${COMMUNITY}/profiles/${steamId}/games/?tab=all`)
    const html = await res.text()
    const attr = /data-profile-gameslist="([^"]*)"/.exec(html)
    let games: unknown
    if (attr) {
      const parsed = parseJson(decodeHtmlAttribute(attr[1]))
      games = isRecord(parsed) ? (parsed.rgGames ?? parsed.games) : parsed
    }
    const list = Array.isArray(games) ? games : null
    return {
      status: res.status,
      embeddedListFound: list !== null,
      count: list ? list.length : null,
      firstHasName: list !== null && list.length > 0 && isRecord(list[0]) && 'name' in list[0]
    }
  })

  await step('N2', report, async () => {
    if (!steamId) return { skipped: true }
    const cfg = await steamSession().fetch(`${STORE}/pointssummary/ajaxgetasyncconfig`)
    const cfgJson = parseJson(await cfg.text())
    const cfgData = isRecord(cfgJson) && isRecord(cfgJson.data) ? cfgJson.data : {}
    const token = cfgData.webapi_token
    if (typeof token !== 'string' || token === '') {
      return { configStatus: cfg.status, tokenFound: false }
    }
    const url =
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/' +
      `?access_token=${encodeURIComponent(token)}&steamid=${steamId}` +
      '&include_appinfo=1&include_played_free_games=1'
    const res = await fetch(url)
    const json = parseJson(await res.text())
    const response = isRecord(json) && isRecord(json.response) ? json.response : {}
    const games = Array.isArray(response.games) ? response.games : null
    return {
      configStatus: cfg.status,
      tokenFound: true,
      status: res.status,
      gameCount: typeof response.game_count === 'number' ? response.game_count : null,
      firstHasName:
        games !== null &&
        games.length > 0 &&
        isRecord(games[0]) &&
        typeof games[0].name === 'string'
    }
  })
}

export async function runProbe(): Promise<void> {
  const report: Report = {}
  try {
    const humbleOk = await ensureSignedIn('humble')
    const steamOk = await ensureSignedIn('steam')
    report.signedIn = { humble: humbleOk, steam: steamOk }
    if (humbleOk) await probeHumble(report)
    if (steamOk) await probeSteam(report)
  } catch (e) {
    report.fatal = { error: e instanceof Error ? e.name : 'unknown' }
  } finally {
    const path = join(process.cwd(), 'probe-report.json')
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
    console.log(`Probe report written to ${path}`)
    app.quit()
  }
}
