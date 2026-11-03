import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHandlers,
  registerHandlers,
  type AppContext,
  type Platform
} from '../../src/main/ipc/handlers'
import { KeyStore } from '../../src/main/store/keyStore'
import { SettingsStore } from '../../src/main/store/settingsStore'
import { plaintextCodec } from '../../src/main/store/codec'
import { SessionExpiredError } from '../../src/shared/errors'
import type { GizmoApi } from '../../src/shared/ipc'
import type { ChoiceMonth, OwnedData } from '../../src/shared/types'
import type { Clock } from '../../src/core/runner'

const GOOD_KEY = 'AAAAA-BBBBB-CCCCC'
const order = (gamekey: string, ...tpks: Record<string, unknown>[]): unknown => ({
  gamekey,
  tpkd_dict: { all_tpks: tpks }
})
const tpk = (
  gamekey: string,
  keyindex: number,
  name: string,
  revealed?: string
): Record<string, unknown> => ({
  machine_name: `m${keyindex}`,
  gamekey,
  keyindex,
  human_name: name,
  key_type_human_name: 'Steam',
  steam_app_id: 100 + keyindex,
  ...(revealed ? { redeemed_key_val: revealed } : {})
})

const owned: OwnedData = { ids: new Set(), names: new Map() }

let dir: string
let keys: KeyStore
let settings: SettingsStore
let events: unknown[]
let platform: Platform & { written: { path: string; data: string }[] }
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> }
let humble: Mocked<AppContext['humble']>
let steam: Mocked<AppContext['steam']>
let clock: Clock

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-handlers-'))
  keys = await KeyStore.open(dir, plaintextCodec)
  settings = await SettingsStore.open(dir)
  events = []
  const written: { path: string; data: string }[] = []
  platform = {
    written,
    send: (_c, p) => void events.push(p),
    openSignIn: vi.fn(async () => true),
    checkSignedIn: vi.fn(async () => true),
    signOut: vi.fn(async () => undefined),
    showSaveDialog: vi.fn(async () => '/tmp/out.csv'),
    writeFile: vi.fn(async (p: string, d: string) => void written.push({ path: p, data: d })),
    openExternal: vi.fn(async () => undefined),
    powerSave: { start: vi.fn(), stop: vi.fn() },
    checkForUpdates: vi.fn(async () => 'error' as const)
  }
  humble = {
    listOrderGamekeys: vi.fn(async () => ['g1']),
    getOrders: vi.fn(async () => ({
      orders: [order('g1', tpk('g1', 1, 'Alpha', GOOD_KEY), tpk('g1', 2, 'Beta'))],
      failed: []
    })),
    revealKey: vi.fn(async () => 'DDDDD-EEEEE-FFFFF'),
    getChoiceMonth: vi.fn(async () => null),
    chooseContent: vi.fn(async () => true)
  } as never
  steam = {
    getOwned: vi.fn(async () => owned),
    registerKey: vi.fn(async () => 1)
  } as never
  clock = {
    now: () => new Date(2026, 10, 2, 13, 5, 9),
    sleepUntil: async () => undefined
  }
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const make = (): ReturnType<typeof createHandlers> =>
  createHandlers({ humble, steam, keys, settings, storageEncrypted: true, platform, clock })

const EXPECTED_METHODS: Exclude<keyof GizmoApi, 'onRunEvent'>[] = [
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
]

describe('registerHandlers', () => {
  it('registers every GizmoApi method except onRunEvent', () => {
    const channels: string[] = []
    registerHandlers({ handle: (c: string) => void channels.push(c) } as never, make())
    expect(channels.sort()).toEqual(EXPECTED_METHODS.map((m) => `gizmo:${m}`).sort())
  })

  it('forwards only name and service of a thrown error', async () => {
    humble.listOrderGamekeys.mockRejectedValue(new SessionExpiredError('steam'))
    const handlers = new Map<string, (...a: unknown[]) => Promise<unknown>>()
    registerHandlers(
      { handle: (c: string, f: never) => void handlers.set(c, f) } as never,
      make(),
      () => true
    )
    const err = await handlers.get('gizmo:loadLibrary')!({}).catch((e: Error) => e)
    expect((err as Error).message).toContain(
      'GIZMO_ERR:{"name":"SessionExpiredError","service":"steam"}'
    )
    expect((err as Error).message).not.toContain('session expired')
  })

  it('createHandlers itself wraps errors', async () => {
    humble.listOrderGamekeys.mockRejectedValue(new SessionExpiredError('humble'))
    const err = await make()
      .loadLibrary()
      .catch((e: Error) => e)
    expect((err as Error).message).toBe(
      'GIZMO_ERR:{"name":"SessionExpiredError","service":"humble"}'
    )
  })
})

describe('library, status, settings', () => {
  it('loadLibrary summarises keys', async () => {
    expect(await make().loadLibrary()).toEqual({ keys: 2, steamKeys: 2, failedOrders: 0 })
  })

  it('status swallows check failures', async () => {
    ;(platform.checkSignedIn as ReturnType<typeof vi.fn>).mockImplementation(async (s: string) => {
      if (s === 'steam') throw new Error('boom')
      return true
    })
    expect(await make().status()).toEqual({ humble: true, steam: false })
  })

  it('storageEncrypted and settings delegate', async () => {
    const h = make()
    expect(await h.storageEncrypted()).toBe(true)
    expect((await h.setSettings({ consentShown: true })).consentShown).toBe(true)
    expect((await h.getSettings()).consentShown).toBe(true)
  })
})

describe('runs', () => {
  it('runs only tickable ids, in the background, with power save', async () => {
    await keys.upsert({
      id: 'g1:2:m2',
      name: 'Beta',
      steamAppId: 102,
      revealedKey: null,
      outcome: 'redeemed',
      resultCode: 1,
      runId: 'old',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    const h = make()
    const review = await h.buildReview()
    const alpha = review.find((r) => r.key.name === 'Alpha')!
    const beta = review.find((r) => r.key.name === 'Beta')!
    expect(alpha.tickable).toBe(true)
    expect(beta.tickable).toBe(false)
    await h.startRun([alpha.key.id, beta.key.id])
    expect(platform.powerSave.start).toHaveBeenCalled()
    await h.__waitForRun()
    expect(steam.registerKey).toHaveBeenCalledTimes(1)
    expect(steam.registerKey).toHaveBeenCalledWith(GOOD_KEY)
    expect(humble.revealKey).not.toHaveBeenCalled()
    expect(platform.powerSave.stop).toHaveBeenCalled()
    expect(events.at(-1)).toMatchObject({ type: 'finished' })
  })

  it('rejects startRun while a run is active', async () => {
    let release: (n: number) => void = () => undefined
    steam.registerKey.mockImplementation(() => new Promise<number>((r) => (release = r)))
    const h = make()
    const [item] = await h.buildReview()
    await h.startRun([item.key.id])
    await expect(h.startRun([item.key.id])).rejects.toThrow('GIZMO_ERR:')
    await vi.waitFor(() => expect(steam.registerKey).toHaveBeenCalled())
    release(1)
    await h.__waitForRun()
    await h.startRun([]) // free again
    await h.__waitForRun()
  })

  it('sends stopped/error and stops power save when the run rejects', async () => {
    steam.registerKey.mockRejectedValue(new Error('boom'))
    const h = make()
    const [item] = await h.buildReview()
    await h.startRun([item.key.id])
    await h.__waitForRun()
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'error' })
    expect(platform.powerSave.stop).toHaveBeenCalled()
  })
})

describe('history and export', () => {
  it('history hides revealed keys and sorts newest first', async () => {
    const base = {
      name: 'n',
      steamAppId: 1,
      revealedKey: GOOD_KEY,
      outcome: 'redeemed' as const,
      resultCode: 1,
      runId: 'r'
    }
    await keys.upsert({ ...base, id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' })
    await keys.upsert({ ...base, id: 'b', updatedAt: '2026-02-01T00:00:00.000Z' })
    const hist = await make().history()
    expect(hist.map((r) => r.id)).toEqual(['b', 'a'])
    expect(hist.every((r) => r.revealedKey === null)).toBe(true)
  })

  const opts = {
    steamOnly: true,
    includeRevealed: true,
    includeUnrevealed: true,
    revealAll: true,
    withOwnership: false
  }

  it('revealAll reveals, upserts pending, and writes the CSV', async () => {
    const res = await make().exportCsv(opts)
    expect(res).toEqual({ saved: true, path: '/tmp/out.csv' })
    expect(humble.revealKey).toHaveBeenCalledTimes(1)
    expect(keys.get('g1:2:m2')).toMatchObject({
      outcome: 'pending',
      runId: 'export',
      revealedKey: 'DDDDD-EEEEE-FFFFF'
    })
    expect(platform.written[0].data).toContain('DDDDD-EEEEE-FFFFF')
    expect(platform.showSaveDialog).toHaveBeenCalledWith('humble-keys-20261102-130509.csv')
  })

  it('writes nothing when the save dialog is cancelled', async () => {
    ;(platform.showSaveDialog as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    expect(await make().exportCsv({ ...opts, revealAll: false })).toEqual({ saved: false })
    expect(platform.written).toEqual([])
  })

  it('includes ownership when asked', async () => {
    await make().exportCsv({ ...opts, revealAll: false, withOwnership: true })
    expect(steam.getOwned).toHaveBeenCalled()
    expect(platform.written[0].data).toContain(',no')
  })
})

describe('openExternal', () => {
  it('forwards allowed URLs only', async () => {
    const h = make()
    await h.openExternal('https://evil.com')
    await h.openExternal('http://www.humblebundle.com/x')
    await h.openExternal('https://humblebundle.com.evil.com/')
    await h.openExternal('https://github.com/other/repo/releases')
    expect(platform.openExternal).not.toHaveBeenCalled()
    await h.openExternal('https://www.humblebundle.com/home')
    await h.openExternal('https://github.com/bobbyrc/humble-gizmo/releases/latest')
    expect(platform.openExternal).toHaveBeenCalledTimes(2)
  })
})

describe('choices', () => {
  const choiceOrder = {
    gamekey: 'g1',
    created: '2026-08-01T10:00:00.000000',
    choices_remaining: 2,
    product: { human_name: 'Choice', category: 'subscriptioncontent', choice_url: 'x' },
    tpkd_dict: { all_tpks: [] }
  }
  const month: ChoiceMonth = {
    gamekey: 'g1',
    name: 'Choice',
    choiceUrl: 'x',
    created: '',
    usesChoices: true,
    choicesRemaining: 2,
    parentIdentifier: 'p',
    games: [
      { identifier: 'ok', title: 'Ok', rating: null, claimable: true, gamekey: 'gk' },
      { identifier: 'nope', title: 'Nope', rating: null, claimable: false, gamekey: null }
    ]
  }
  beforeEach(() => {
    humble.getOrders.mockResolvedValue({ orders: [choiceOrder], failed: [] })
    humble.getChoiceMonth.mockResolvedValue(month)
  })

  it('fails non-claimable and unknown games without calling chooseContent for them', async () => {
    const h = make()
    expect(await h.listChoiceMonths()).toEqual([month])
    const res = await h.claimChoices('g1', ['ok', 'nope', 'missing'])
    expect(res.failed).toEqual(['nope', 'missing'])
    expect(humble.chooseContent).toHaveBeenCalledTimes(1)
    expect(humble.chooseContent).toHaveBeenCalledWith('gk', 'p', 'ok')
    expect(humble.getOrders).toHaveBeenLastCalledWith(['g1'])
  })

  it('records false and thrown results as failed but rethrows session expiry', async () => {
    const h = make()
    await h.listChoiceMonths()
    humble.chooseContent.mockResolvedValueOnce(false)
    expect((await h.claimChoices('g1', ['ok'])).failed).toEqual(['ok'])
    humble.chooseContent.mockRejectedValueOnce(new Error('x'))
    expect((await h.claimChoices('g1', ['ok'])).failed).toEqual(['ok'])
    humble.chooseContent.mockRejectedValueOnce(new SessionExpiredError('humble'))
    await expect(h.claimChoices('g1', ['ok'])).rejects.toThrow('SessionExpiredError')
  })
})

describe('deleteAllData', () => {
  it('wipes keys, settings, sessions and caches', async () => {
    await keys.upsert({
      id: 'a',
      name: 'n',
      steamAppId: 1,
      revealedKey: null,
      outcome: 'pending',
      resultCode: null,
      runId: 'r',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    const h = make()
    await h.setSettings({ consentShown: true })
    await h.deleteAllData()
    expect(keys.all().size).toBe(0)
    expect(settings.get().consentShown).toBe(false)
    expect(platform.signOut).toHaveBeenCalledWith('humble')
    expect(platform.signOut).toHaveBeenCalledWith('steam')
    await h.loadLibrary()
    expect(humble.listOrderGamekeys).toHaveBeenCalledTimes(1)
  })
})

describe('fix round 1', () => {
  const failFn = (): never => {
    throw new Error('x')
  }

  it('buildReview never returns revealed keys but startRun still uses them', async () => {
    const h = make()
    const review = await h.buildReview()
    expect(review.length).toBeGreaterThan(0)
    expect(review.every((it) => it.key.revealedKey === null)).toBe(true)
    const alpha = review.find((r) => r.key.name === 'Alpha')!
    await h.startRun([alpha.key.id])
    await h.__waitForRun()
    expect(steam.registerKey).toHaveBeenCalledWith(GOOD_KEY)
  })

  it('powerSave.start throwing leaves no active runner', async () => {
    const h = make()
    const [item] = await h.buildReview()
    ;(platform.powerSave.start as ReturnType<typeof vi.fn>).mockImplementationOnce(failFn)
    await expect(h.startRun([item.key.id])).rejects.toThrow('GIZMO_ERR:')
    await h.startRun([item.key.id])
    await h.__waitForRun()
  })

  it('a second startRun without rebuilding the review runs nothing', async () => {
    const h = make()
    const review = await h.buildReview()
    const ids = review.map((r) => r.key.id)
    await h.startRun(ids)
    await h.__waitForRun()
    const calls = steam.registerKey.mock.calls.length
    humble.revealKey.mockClear()
    await h.startRun(ids)
    await h.__waitForRun()
    expect(steam.registerKey.mock.calls.length).toBe(calls)
    expect(humble.revealKey).not.toHaveBeenCalled()
  })

  it('run state is cleared even when powerSave.stop throws', async () => {
    ;(platform.powerSave.stop as ReturnType<typeof vi.fn>).mockImplementationOnce(failFn)
    const h = make()
    const [item] = await h.buildReview()
    await h.startRun([item.key.id])
    await h.__waitForRun().catch(() => undefined)
    await h.startRun([]) // would reject if still active
    await h.__waitForRun()
  })

  it('exportCsv revealAll keeps an existing record outcome and adds the key', async () => {
    await keys.upsert({
      id: 'g1:2:m2',
      name: 'Beta',
      steamAppId: 102,
      revealedKey: null,
      outcome: 'error',
      resultCode: 15,
      runId: 'old',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    await make().exportCsv({
      steamOnly: true,
      includeRevealed: true,
      includeUnrevealed: true,
      revealAll: true,
      withOwnership: false
    })
    expect(keys.get('g1:2:m2')).toMatchObject({
      outcome: 'error',
      revealedKey: 'DDDDD-EEEEE-FFFFF'
    })
  })

  it('claimChoices removes claimed games from the cache and survives a refresh failure', async () => {
    const choiceOrder = {
      gamekey: 'g1',
      created: '2026-08-01T10:00:00.000000',
      choices_remaining: 2,
      product: { human_name: 'C', category: 'subscriptioncontent', choice_url: 'x' },
      tpkd_dict: { all_tpks: [] }
    }
    const month: ChoiceMonth = {
      gamekey: 'g1',
      name: 'C',
      choiceUrl: 'x',
      created: '',
      usesChoices: true,
      choicesRemaining: 2,
      parentIdentifier: 'p',
      games: [{ identifier: 'ok', title: 'Ok', rating: null, claimable: true, gamekey: 'gk' }]
    }
    humble.getOrders.mockResolvedValue({ orders: [choiceOrder], failed: [] })
    humble.getChoiceMonth.mockResolvedValue(month)
    const h = make()
    await h.listChoiceMonths()
    humble.getOrders.mockRejectedValue(new Error('refresh failed'))
    expect(await h.claimChoices('g1', ['ok'])).toEqual({ failed: [] })
    expect((await h.claimChoices('g1', ['ok'])).failed).toEqual(['ok'])
    expect(humble.chooseContent).toHaveBeenCalledTimes(1)
  })

  it('deleteAllData stops an active run and tolerates sign-out errors', async () => {
    let release: (n: number) => void = () => undefined
    steam.registerKey.mockImplementation(() => new Promise<number>((r) => (release = r)))
    ;(platform.signOut as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'))
    const h = make()
    const review = await h.buildReview()
    await h.startRun(review.map((r) => r.key.id))
    await vi.waitFor(() => expect(steam.registerKey).toHaveBeenCalled())
    await h.deleteAllData()
    release(1)
    await h.__waitForRun()
    expect(events.at(-1)).toMatchObject({ type: 'stopped', reason: 'user' })
  })

  it('registerHandlers rejects untrusted senders', async () => {
    const handlers = new Map<string, (...a: unknown[]) => Promise<unknown>>()
    registerHandlers(
      { handle: (c: string, f: never) => void handlers.set(c, f) } as never,
      make(),
      (e) => (e as { senderFrame?: { url: string } }).senderFrame?.url === 'file:///app/index.html'
    )
    const h = handlers.get('gizmo:storageEncrypted')!
    await expect(h({ senderFrame: { url: 'https://evil.com/' } })).rejects.toThrow('GIZMO_ERR:')
    expect(await h({ senderFrame: { url: 'file:///app/index.html' } })).toBe(true)
  })
})
