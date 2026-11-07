import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findChoiceOrders, parseMonthPage } from '../../core/choice'
import { hasLeaks, sanitizeWithOriginals } from '../../core/sanitize'
import { HumbleApi } from '../humble/humbleApi'
import { steamIdFromLoginCookie } from '../steam/steamId'
import { trimOrders, trimOwnedNames, trimUserdata } from './fixtureTrim'
import { SessionHttpClient } from '../net/sessionHttpClient'
import { createHumbleHttpClient } from '../net/transportConfig'
import { checkSignedIn, openSignInWindow } from '../windows/signIn'

/**
 * Dev tool (npm run capture): saves SANITIZED Humble and Steam responses as test fixtures in
 * test/fixtures/captured/. Raw responses stay in memory. This code never logs a body, cookie,
 * token or key; it prints only file names and counts.
 */

const HUMBLE = 'https://www.humblebundle.com'
const STORE = 'https://store.steampowered.com'
const API = 'https://api.steampowered.com'
const ORDER_COUNT = 30
const EXTRA_BATCH = 30

const OUT_DIR = join(process.cwd(), 'test', 'fixtures', 'captured')

async function ensureSignedIn(service: 'humble' | 'steam'): Promise<boolean> {
  if (await checkSignedIn(service)) return true
  await openSignInWindow(service)
  return checkSignedIn(service)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function isChoiceOrder(o: unknown): boolean {
  return isRecord(o) && isRecord(o.product) && o.product.category === 'subscriptioncontent'
}

/** Sanitizes, refuses to write if anything key- or email-shaped survived, then writes pretty JSON. */
function save(name: string, raw: unknown, salt: string): void {
  const { value: clean, originals } = sanitizeWithOriginals(raw, salt)
  const text = JSON.stringify(clean, null, 2) + '\n'
  if (hasLeaks(text, originals)) {
    throw new Error(`refusing to write ${name}: the leak guard found something real`)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, name), text)
  console.log(`wrote ${name}`)
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    console.log(`${name} failed: ${e instanceof Error ? e.name : 'unknown'}`)
  }
}

async function captureHumble(salt: string): Promise<void> {
  const http = createHumbleHttpClient()
  const api = new HumbleApi(http)
  const gamekeys = await api.listOrderGamekeys()
  console.log(`humble order list: ${gamekeys.length} orders`)

  const first = await api.getOrders(gamekeys.slice(0, ORDER_COUNT), { concurrency: 5 })
  const orders = [...first.orders]
  if (first.failed.length > 0) console.log(`humble: ${first.failed.length} orders failed`)

  // Make sure at least one Choice (subscriptioncontent) order is in the sample.
  let rest = gamekeys.slice(ORDER_COUNT)
  while (!orders.some(isChoiceOrder) && rest.length > 0) {
    const batch = await api.getOrders(rest.slice(0, EXTRA_BATCH), { concurrency: 5 })
    orders.push(...batch.orders.filter(isChoiceOrder))
    rest = rest.slice(EXTRA_BATCH)
  }
  save('orders.json', trimOrders(orders), salt)

  await step('choice-month', async () => {
    const choice = findChoiceOrders(orders)[0]
    if (!choice) {
      console.log('no claimable Choice order; choice-month.json skipped')
      return
    }
    const res = await http.get(`${HUMBLE}/membership/${encodeURIComponent(choice.choiceUrl)}`)
    if (res.status < 200 || res.status >= 300) throw new Error('choice page status')
    save('choice-month.json', parseMonthPage(res.body), salt)
  })
}

async function captureSteam(salt: string): Promise<void> {
  const http = new SessionHttpClient('persist:steam')

  await step('userdata', async () => {
    const res = await http.get(`${STORE}/dynamicstore/userdata/`)
    const json = parseJson(res.body)
    if (res.status !== 200 || json === undefined) throw new Error('userdata response')
    save('userdata.json', trimUserdata(json), salt)
  })

  await step('owned-names', async () => {
    const cfg = await http.get(`${STORE}/pointssummary/ajaxgetasyncconfig`)
    const cfgJson = parseJson(cfg.body)
    const data = isRecord(cfgJson) && isRecord(cfgJson.data) ? cfgJson.data : {}
    const token = data.webapi_token
    const login = await http.getCookie(STORE, 'steamLoginSecure')
    const steamId = login ? steamIdFromLoginCookie(login) : null
    if (typeof token !== 'string' || token === '' || steamId === null) {
      throw new Error('no web token or steam id')
    }
    const query = new URLSearchParams({
      access_token: token,
      steamid: steamId,
      include_appinfo: '1',
      include_played_free_games: '1'
    })
    const res = await http.get(`${API}/IPlayerService/GetOwnedGames/v1/?${query.toString()}`)
    const json = parseJson(res.body)
    if (res.status !== 200 || json === undefined) throw new Error('owned games response')
    save('owned-names.json', trimOwnedNames(json), salt)
  })
}

export async function runCapture(): Promise<void> {
  const salt = randomBytes(16).toString('hex')
  try {
    const humbleOk = await ensureSignedIn('humble')
    const steamOk = await ensureSignedIn('steam')
    if (humbleOk) await step('humble', () => captureHumble(salt))
    else console.log('humble: not signed in, skipped')
    if (steamOk) await step('steam', () => captureSteam(salt))
    else console.log('steam: not signed in, skipped')
  } finally {
    console.log(`Capture finished. Files are in ${OUT_DIR}`)
    app.quit()
  }
}
