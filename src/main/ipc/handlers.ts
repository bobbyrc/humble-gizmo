import type { IpcMain } from 'electron'
import { extractKeys, steamKeys } from '../../core/keys'
import { buildReviewList, EXPORT_RUN_ID } from '../../core/review'
import { classifyOwnership } from '../../core/ownership'
import { findChoiceOrders } from '../../core/choice'
import { selectExportKeys, toExportCsv } from '../../core/export'
import { RedeemRunner, systemClock, type Clock } from '../../core/runner'
import { ServiceChangedError, SessionExpiredError } from '../../shared/errors'
import type { GizmoApi } from '../../shared/ipc'
import {
  DEFAULT_SETTINGS,
  type ChoiceMonth,
  type HumbleKey,
  type OwnedData,
  type Ownership,
  type ReviewItem,
  type RunEvent,
  type Service,
  type Settings
} from '../../shared/types'
import { ChoicePageRedirectError, type HumbleApi } from '../humble/humbleApi'
import type { SteamApi } from '../steam/steamApi'
import type { KeyStore } from '../store/keyStore'
import type { SettingsStore } from '../store/settingsStore'

export type Platform = {
  send(channel: string, payload: unknown): void
  openSignIn(service: Service): Promise<boolean>
  checkSignedIn(service: Service): Promise<boolean>
  signOut(service: Service): Promise<void>
  showSaveDialog(defaultName: string): Promise<string | null>
  writeFile(path: string, data: string): Promise<void>
  openExternal(url: string): Promise<void>
  powerSave: { start(): void; stop(): void }
  checkForUpdates(): Promise<'none' | 'available' | 'error'>
}

export type AppContext = {
  humble: Pick<
    HumbleApi,
    'listOrderGamekeys' | 'getOrders' | 'revealKey' | 'getChoiceMonth' | 'chooseContent'
  >
  steam: Pick<SteamApi, 'getOwned' | 'registerKey'>
  keys: KeyStore
  settings: SettingsStore
  storageEncrypted: boolean
  platform: Platform
  clock?: Clock
  /** Called after setSettings succeeds, with the saved settings. */
  onSettingsChanged?: (s: Settings) => void
  /** Called after Delete all data and after a Humble sign-out: anything derived from the account is stale. */
  onDataReset?: () => void
}

/**
 * GizmoApi plus a test hook that resolves when the current background run has settled, and
 * isRunActive (main-process only, not an IPC method).
 */
export type Handlers = GizmoApi & {
  __waitForRun(): Promise<void>
  isRunActive(): boolean
  /** Ids of ticked will_redeem keys right now. Reads only and leaves every cache alone. */
  peekWillRedeemIds(): Promise<string[]>
}

const ERR_MARKER = 'GIZMO_ERR:'

/** Every GizmoApi method that crosses IPC (onRunEvent and onLibraryProgress are preload-only). */
const IPC_METHODS = [
  'getSettings',
  'setSettings',
  'signIn',
  'signOut',
  'status',
  'loadLibrary',
  'buildReview',
  'startRun',
  'stopRun',
  'listChoiceMonths',
  'claimChoices',
  'openExternal',
  'history',
  'exportCsv',
  'deleteAllData',
  'checkForUpdatesNow',
  'storageEncrypted'
] as const satisfies readonly (keyof GizmoApi)[]

type AnyAsync = (...args: unknown[]) => Promise<unknown>

/**
 * Electron keeps only `message` across IPC, and the original message could contain data, so
 * only the error name and service are forwarded. Idempotent.
 */
function toIpcError(e: unknown): Error {
  if (e instanceof Error && e.message.startsWith(ERR_MARKER)) return e
  const err = e as { name?: unknown; service?: unknown } | null
  // The shared error classes don't set `name`, so name them explicitly.
  const name =
    e instanceof SessionExpiredError
      ? 'SessionExpiredError'
      : e instanceof ServiceChangedError
        ? 'ServiceChangedError'
        : typeof err?.name === 'string'
          ? err.name
          : 'Error'
  const service = typeof err?.service === 'string' ? err.service : null
  return new Error(ERR_MARKER + JSON.stringify({ name, service }))
}

function wrap(fn: AnyAsync): AnyAsync {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      throw toIpcError(e)
    }
  }
}

const SUFFIX_HOSTS = ['humblebundle.com', 'steampowered.com', 'steamcommunity.com']

function isExternalAllowed(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (SUFFIX_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) return true
  return host === 'github.com' && u.pathname.startsWith('/bobbyrc/humble-gizmo/releases')
}

const pad = (n: number): string => String(n).padStart(2, '0')

function exportName(d: Date): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `humble-keys-${date}-${time}.csv`
}

type Library = { orders: unknown[]; keys: HumbleKey[]; failedOrders: number }

export function createHandlers(ctx: AppContext): Handlers {
  const { humble, steam, keys, settings, platform } = ctx
  const clock = ctx.clock ?? systemClock

  let library: Library | null = null
  let review: ReviewItem[] | null = null
  let months = new Map<string, ChoiceMonth>()
  let owned: OwnedData | null = null
  let activeRunner: RedeemRunner | null = null
  let runDone: Promise<void> = Promise.resolve()

  const clearCaches = (): void => {
    library = null
    review = null
    months = new Map()
    owned = null
  }

  const loadLibrary = async (): Promise<Library> => {
    const gamekeys = await humble.listOrderGamekeys()
    const { orders, failed } = await humble.getOrders(gamekeys, {
      onProgress: (done, total) => platform.send('gizmo:library-progress', { done, total })
    })
    const lib: Library = { orders, keys: extractKeys(orders), failedOrders: failed.length }
    library = lib
    review = null
    months = new Map()
    owned = null
    return lib
  }

  const requireLibrary = async (): Promise<Library> => library ?? loadLibrary()
  const requireOwned = async (): Promise<OwnedData> => owned ?? (owned = await steam.getOwned())

  const api: Handlers = {
    getSettings: async () => settings.get(),
    setSettings: async (patch) => {
      const saved = await settings.update(patch)
      try {
        ctx.onSettingsChanged?.(saved)
      } catch {
        // the settings are saved; a failing side effect must not fail the call
      }
      return saved
    },
    signIn: (s) => platform.openSignIn(s),
    signOut: async (s) => {
      await platform.signOut(s)
      if (s === 'humble') {
        clearCaches()
        ctx.onDataReset?.()
      }
    },
    status: async () => {
      const [humbleIn, steamIn] = await Promise.all([
        platform.checkSignedIn('humble').catch(() => false),
        platform.checkSignedIn('steam').catch(() => false)
      ])
      return { humble: humbleIn, steam: steamIn }
    },

    loadLibrary: async (opts) => {
      // A cached library needs no network call unless the caller asks for a refresh.
      const lib = opts?.refresh !== true && library ? library : await loadLibrary()
      return {
        keys: lib.keys.length,
        steamKeys: steamKeys(lib.keys).length,
        failedOrders: lib.failedOrders
      }
    },

    buildReview: async () => {
      const lib = await requireLibrary()
      const built = buildReviewList(lib.keys, await requireOwned(), keys.all())
      review = built
      // Revealed values stay in the main process; the renderer gets copies without them.
      return built.map((it) => ({ ...it, key: { ...it.key, revealedKey: null } }))
    },

    startRun: async (ids) => {
      if (activeRunner) throw new Error('A run is already active')
      // Redeeming changes what Steam owns; the next review must not reuse the cached list.
      owned = null
      const wanted = new Set(ids)
      const toRun = (review ?? [])
        .filter((it) => it.tickable && wanted.has(it.key.id))
        .map((it) => it.key)
      const send = (e: RunEvent): void => platform.send('gizmo:run-event', e)
      const runner = new RedeemRunner({
        reveal: (k) => humble.revealKey(k),
        register: (key) => steam.registerKey(key),
        store: keys,
        clock,
        onEvent: send
      })
      const runId = globalThis.crypto.randomUUID()
      platform.powerSave.start()
      activeRunner = runner
      review = null // a run changes record state; the renderer must rebuild before the next one
      runDone = (async () => {
        try {
          await runner.run(toRun, runId)
        } catch {
          send({ type: 'stopped', reason: 'error' })
        } finally {
          activeRunner = null
          try {
            platform.powerSave.stop()
          } catch {
            // the run is over either way
          }
        }
      })()
    },

    stopRun: async () => {
      activeRunner?.stop()
    },

    onRunEvent: () => {
      throw new Error('onRunEvent is implemented in the preload')
    },
    onLibraryProgress: () => {
      throw new Error('onLibraryProgress is implemented in the preload')
    },

    listChoiceMonths: async () => {
      const lib = await requireLibrary()
      let sessionCheck: Promise<unknown> | undefined
      const results = await mapLimit(findChoiceOrders(lib.orders), 4, async (order) => {
        try {
          return await humble.getChoiceMonth(order)
        } catch (e) {
          if (!(e instanceof ChoicePageRedirectError)) throw e
          // Humble redirects a month page it will not open. Confirm the session is still
          // valid first, so a signed-out user still gets the sign-in prompt.
          sessionCheck ??= humble.listOrderGamekeys()
          await sessionCheck
          return 'locked' as const
        }
      })
      const found = results.filter((m): m is ChoiceMonth => m !== null && m !== 'locked')
      const locked = results.filter((m) => m === 'locked').length
      months = new Map(found.map((m) => [m.gamekey, m]))
      return { months: found, locked }
    },

    claimChoices: async (monthGamekey, identifiers) => {
      let month = months.get(monthGamekey)
      const failed: string[] = []
      for (const identifier of identifiers) {
        const game = month?.games.find((g) => g.identifier === identifier)
        if (!month || !game || !game.claimable || !game.gamekey) {
          failed.push(identifier)
          continue
        }
        try {
          const ok = await humble.chooseContent(game.gamekey, month.parentIdentifier, identifier)
          if (!ok) failed.push(identifier)
          else {
            const left = { ...month, games: month.games.filter((g) => g.identifier !== identifier) }
            months.set(monthGamekey, left)
            month = left
          }
        } catch (e) {
          if (e instanceof SessionExpiredError) throw e
          failed.push(identifier)
        }
      }
      if (month && library) {
        try {
          const refreshed = await humble.getOrders([monthGamekey])
          if (refreshed.orders.length > 0) {
            const lib = library as Library
            const fresh = refreshed.orders[0]
            const idx = lib.orders.findIndex(
              (o) => (o as { gamekey?: unknown } | null)?.gamekey === monthGamekey
            )
            if (idx >= 0) lib.orders[idx] = fresh
            else lib.orders.push(fresh)
            lib.keys = extractKeys(lib.orders)
          }
        } catch (e) {
          if (e instanceof SessionExpiredError) throw e
          // the claims went through; a stale cache is acceptable
        }
      }
      return { failed }
    },

    openExternal: async (url) => {
      if (isExternalAllowed(url)) await platform.openExternal(url)
    },

    history: async () =>
      [...keys.all().values()]
        .filter((r) => !(r.outcome === 'pending' && r.runId === EXPORT_RUN_ID))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((r) => ({ ...r, revealedKey: null })),

    exportCsv: async (opts) => {
      const lib = await requireLibrary()
      const selected = selectExportKeys(lib.keys, opts)
      if (opts.revealAll) {
        for (const k of selected) {
          if (k.revealedKey !== null) continue
          const v = await humble.revealKey(k)
          if (!v) continue
          k.revealedKey = v
          const existing = keys.get(k.id)
          if (existing) {
            if (existing.revealedKey === null) await keys.upsert({ ...existing, revealedKey: v })
          } else {
            await keys.upsert({
              id: k.id,
              name: k.name,
              steamAppId: k.steamAppId,
              revealedKey: v,
              outcome: 'pending',
              resultCode: null,
              runId: EXPORT_RUN_ID,
              updatedAt: clock.now().toISOString()
            })
          }
        }
      }
      let ownership: Map<string, Ownership> | null = null
      if (opts.withOwnership) {
        const owned = await steam.getOwned()
        ownership = new Map(
          selected
            .filter((k) => k.isSteam)
            .map((k) => [k.id, classifyOwnership(k, owned).ownership])
        )
      }
      const csv = toExportCsv(selected, ownership)
      const path = await platform.showSaveDialog(exportName(clock.now()))
      if (path === null) return { saved: false }
      await platform.writeFile(path, csv)
      return { saved: true, path }
    },

    deleteAllData: async () => {
      activeRunner?.stop()
      // The runner may still be mid-attempt; wait so its last upsert cannot land after the wipe.
      await runDone
      clearCaches()
      await keys.deleteAll()
      ctx.onDataReset?.()
      const reset = await settings.update(DEFAULT_SETTINGS)
      try {
        ctx.onSettingsChanged?.(reset)
      } catch {
        // the data is gone; a failing side effect must not fail the call
      }
      await platform.signOut('humble').catch(() => undefined)
      await platform.signOut('steam').catch(() => undefined)
    },

    checkForUpdatesNow: () => platform.checkForUpdates(),
    storageEncrypted: async () => ctx.storageEncrypted,
    __waitForRun: () => runDone,
    isRunActive: () => activeRunner !== null,
    peekWillRedeemIds: async () => {
      // Local variables only: the user's library, review and choice caches must stay as they are.
      const gamekeys = await humble.listOrderGamekeys()
      const { orders } = await humble.getOrders(gamekeys)
      const owned = await steam.getOwned()
      return buildReviewList(extractKeys(orders), owned, keys.all())
        .filter((it) => it.group === 'will_redeem' && it.ticked)
        .map((it) => it.key.id)
    }
  }

  const wrapped = { ...api } as Record<string, unknown>
  for (const name of IPC_METHODS) wrapped[name] = wrap(api[name] as AnyAsync)
  return wrapped as Handlers
}

/** Maps items with at most `limit` calls in flight, keeping results in input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Only our own page may call the bridge: a file: URL in production, the dev server in dev. */
export function defaultIsTrustedSender(event: unknown): boolean {
  const url = (event as { senderFrame?: { url?: string } } | null)?.senderFrame?.url
  if (typeof url !== 'string') return false
  if (url.startsWith('file://')) return true
  const dev = process.env['ELECTRON_RENDERER_URL']
  return dev !== undefined && dev !== '' && new URL(url).origin === new URL(dev).origin
}

export function registerHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  api: GizmoApi,
  isTrustedSender: (event: unknown) => boolean = defaultIsTrustedSender
): void {
  for (const name of IPC_METHODS) {
    const fn = api[name] as AnyAsync
    ipc.handle(
      `gizmo:${name}`,
      wrap(async (e, ...args) => {
        if (!isTrustedSender(e)) throw new Error('untrusted sender')
        return fn(...args)
      })
    )
  }
}
