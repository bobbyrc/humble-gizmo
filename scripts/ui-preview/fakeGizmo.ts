import type { GizmoApi } from '../../src/shared/ipc'
import {
  DEFAULT_SETTINGS,
  type ChoiceMonth,
  type HumbleKey,
  type KeyRecord,
  type Outcome,
  type ReviewGroup,
  type ReviewItem,
  type ReviewReason,
  type RunEvent,
  type Service,
  type Settings
} from '../../src/shared/types'

const NAMES = [
  'Hollow Lantern',
  'Brinewick',
  'Starfall Courier',
  'Moss & Mortar',
  'Paper Tigers',
  'Gearheart',
  'Lowtide',
  'The Quiet Orchard',
  'Cinder Run',
  'Wren of the Deep',
  'Tinker Tactics',
  'Saltmarsh Kings',
  'Neon Parish',
  'Barrow Down',
  'Oddsparrow',
  'Fable Foundry',
  'Drift Cartographer',
  'Glasswing',
  'Pocket Citadel',
  'Mothlight',
  'Rust Choir',
  'Kettle & Crow',
  'Emberlight Tactics',
  'Tallow Hill',
  'Vesper Station',
  'Copperhead Gulch',
  'Lanternfish',
  'Orbital Gardener',
  'Hex Harvest',
  'Quillfeather',
  'Dustbowl Dynasty',
  'Afterglow Arcade',
  'The Long Hallway',
  'Marrow Fields',
  'Skyhook',
  'Tidewrack',
  'Bramble Knight',
  'Cloudline Rangers',
  'Halcyon Heist',
  'Pebblebrook'
]
const BUNDLES = [
  'Humble Indie Bundle 19',
  'Humble Choice — March 2020',
  'Humble Strategy Bundle',
  'Humble Indie Bundle 5',
  'Humble Roguelike Bundle',
  'Humble Choice — June 2022',
  'Humble Heroic Bundle',
  'Humble Pixel Art Bundle',
  'Humble Choice — January 2024',
  'Humble Tabletop Bundle'
]
const pad = (n: number): string => String(n).padStart(2, '0')
const purchased = (i: number): string =>
  `${2012 + ((i * 5) % 13)}-${pad(1 + ((i * 7) % 12))}-${pad(1 + ((i * 11) % 28))}`

let seq = 0
function key(name: string, i: number, revealed: boolean): HumbleKey {
  const n = seq++
  const machineName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + (n % 3)
  const gamekey = 'GK' + (1000 + (n % 220)).toString(36).toUpperCase() + 'x'
  const keyindex = Math.floor(n / 220)
  return {
    id: `${gamekey}:${keyindex}:${machineName}`,
    gamekey,
    keyindex,
    machineName,
    name,
    keyTypeName: 'Steam',
    isSteam: true,
    steamAppId: 100000 + n * 37,
    revealedKey: revealed ? `A${n}B2C-D3E4F-G5H6J` : null,
    isGift: false,
    isExpired: false,
    bundle: BUNDLES[i % BUNDLES.length],
    purchased: purchased(i)
  } as HumbleKey
}

function buildReview(): ReviewItem[] {
  seq = 0
  const out: ReviewItem[] = []
  let i = 0
  const add = (
    count: number,
    group: ReviewGroup,
    f: (j: number) => Partial<ReviewItem> & { revealed?: boolean; name?: string }
  ): void => {
    for (let j = 0; j < count; j++, i++) {
      const { revealed, name, ...rest } = f(j)
      out.push({
        key: key(name ?? NAMES[i % NAMES.length], i, revealed ?? false),
        group,
        ticked: false,
        tickable: true,
        reasons: [],
        ...rest
      })
    }
  }
  add(143, 'will_redeem', (j) => {
    const dup =
      j >= 140 ? { name: NAMES[0], reasons: ['duplicate'] as ReviewReason[], ticked: false } : null
    if (dup) return dup
    return { ticked: true, reasons: j % 3 === 0 ? ['unrevealed'] : [] }
  })
  add(12, 'maybe_owned', (j) => ({
    matchedName: NAMES[(j * 3 + 1) % NAMES.length] + (j % 2 ? ' Definitive Edition' : ': Complete')
  }))
  add(318, 'owned', () => ({}))
  add(6, 'failed_before', (j) => ({
    reasons: [j < 3 ? 'terminal_error' : 'retryable_error'] as ReviewReason[],
    tickable: j >= 3
  }))
  add(40, 'done_before', () => ({ tickable: false, revealed: true }))
  return out
}

function history(): KeyRecord[] {
  const now = Date.now()
  const outcomes: [Outcome, number | null][] = [
    ['redeemed', null],
    ['redeemed', null],
    ['owned', 9],
    ['redeemed', null],
    ['error', 15],
    ['redeemed', null],
    ['error', 14],
    ['redeemed', null],
    ['error', 24],
    ['redeemed', null]
  ]
  return Array.from({ length: 60 }, (_, i) => {
    const [outcome, resultCode] =
      i === 3 ? (['pending', null] as [Outcome, null]) : outcomes[i % outcomes.length]
    return {
      id: `HK${i}:0:game_${i}`,
      name: NAMES[i % NAMES.length],
      steamAppId: 200000 + i * 13,
      revealedKey: outcome === 'redeemed' ? `XQ${i}7R-LM2P9-ZT4W${i % 10}` : null,
      outcome,
      resultCode,
      runId: 'run' + (i % 5),
      updatedAt: new Date(now - (i / 60) * 180 * 86400000).toISOString()
    }
  })
}

function choiceMonths(): ChoiceMonth[] {
  const ratings = [0.93, 0.88, 0.81, 0.76, 0.95, 0.7, 0.84, 0.9]
  const texts = [
    'Very Positive',
    'Very Positive',
    'Very Positive',
    'Mostly Positive',
    'Overwhelmingly Positive',
    'Mixed',
    'Very Positive',
    'Very Positive'
  ]
  const games = (n: number, off: number, claim: boolean): ChoiceMonth['games'] =>
    Array.from({ length: n }, (_, i) => ({
      identifier: `choice_${off}_${i}`,
      title: NAMES[(off + i) % NAMES.length],
      rating: i === 5 ? null : { text: texts[i % 8], percent: ratings[i % 8] },
      claimable: claim && i !== 6,
      gamekey: 'CHOICEKEY' + off
    }))
  return [
    {
      gamekey: 'CHOICEKEY1',
      name: 'Humble Choice — March 2020',
      choiceUrl: 'https://www.humblebundle.com/subscription/march-2020',
      created: '2020-03-02T18:00:00Z',
      usesChoices: true,
      choicesRemaining: 3,
      parentIdentifier: 'march_2020',
      games: games(8, 3, true)
    },
    {
      gamekey: 'CHOICEKEY2',
      name: 'Humble Choice — June 2022',
      choiceUrl: 'https://www.humblebundle.com/subscription/june-2022',
      created: '2022-06-03T18:00:00Z',
      usesChoices: false,
      choicesRemaining: 0,
      parentIdentifier: 'june_2022',
      games: games(6, 20, true)
    }
  ]
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function fakeGizmo(scenario: string): GizmoApi {
  let settings: Settings = { ...DEFAULT_SETTINGS, consentShown: scenario !== 'welcome' }
  const signed: Record<Service, boolean> = { humble: true, steam: scenario !== 'signin' }
  const listeners = new Set<(e: RunEvent) => void>()
  const emit = (e: RunEvent): void => listeners.forEach((l) => l(e))
  const failedOrders = scenario === 'review-warn' ? 3 : 0
  const cycle: [Exclude<Outcome, 'pending'>, number | null][] = [
    ['redeemed', null],
    ['redeemed', null],
    ['owned', 9],
    ['redeemed', null],
    ['error', 14],
    ['redeemed', null]
  ]

  return {
    getSettings: async () => settings,
    setSettings: async (patch) => (settings = { ...settings, ...patch }),
    signIn: async (service) => {
      await sleep(600)
      signed[service] = true
      if (scenario === 'signin') signed.steam = true
      return true
    },
    signOut: async (service) => {
      signed[service] = false
    },
    status: async () => ({ ...signed }),
    loadLibrary: async () => ({ keys: 640, steamKeys: 519, failedOrders }),
    buildReview: async () => {
      if (scenario === 'empty') return []
      if (scenario === 'review-error') {
        throw new Error(
          'GIZMO_ERR:' + JSON.stringify({ name: 'ServiceChangedError', service: 'humble' })
        )
      }
      return buildReview()
    },
    startRun: async (ids) => {
      void (async () => {
        const run = ids.slice(0, 10)
        for (let i = 0; i < run.length; i++) {
          emit({ type: 'key-start', id: run[i] })
          await sleep(300)
          const [outcome, code] = cycle[i % cycle.length]
          emit({ type: 'key-done', id: run[i], outcome, code })
          if (i === 7 && scenario !== 'run-done') {
            emit({
              type: 'rate-limited',
              id: run[8] ?? run[i],
              resumeAt: new Date(Date.now() + 3600000).toISOString(),
              attempt: 1
            })
            return
          }
        }
        if (scenario === 'run-done') {
          const o = run.map((_, i) => cycle[i % cycle.length][0])
          emit({
            type: 'finished',
            summary: {
              redeemed: o.filter((x) => x === 'redeemed').length,
              owned: o.filter((x) => x === 'owned').length,
              errors: o.filter((x) => x === 'error').length,
              remaining: Math.max(0, ids.length - run.length)
            }
          })
        }
      })()
    },
    stopRun: async () => emit({ type: 'stopped', reason: 'user' }),
    onRunEvent: (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    listChoiceMonths: async () => choiceMonths(),
    claimChoices: async () => {
      await sleep(500)
      return { failed: [] }
    },
    openExternal: async () => undefined,
    history: async () => history(),
    exportCsv: async () => ({ saved: false }),
    deleteAllData: async () => undefined,
    checkForUpdatesNow: async () => 'none',
    storageEncrypted: async () => scenario !== 'settings-nokeyring'
  }
}
