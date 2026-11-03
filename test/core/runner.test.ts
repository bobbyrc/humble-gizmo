import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedeemRunner, systemClock, type Clock } from '../../src/core/runner'
import { SessionExpiredError } from '../../src/shared/errors'
import type { HumbleKey, KeyRecord, RunEvent } from '../../src/shared/types'

const HOUR = 3_600_000

function mkKey(n: number, revealedKey: string | null = null): HumbleKey {
  return {
    id: `gk:${n}:m${n}`,
    gamekey: 'gk',
    keyindex: n,
    machineName: `m${n}`,
    name: `Game ${n}`,
    keyTypeName: 'Steam',
    isSteam: true,
    steamAppId: 1000 + n,
    revealedKey,
    isGift: false,
    isExpired: false
  }
}

const GOOD = (n: number): string => `AAAAA-BBBBB-CCC${n}${n}`

class FakeClock implements Clock {
  t = Date.parse('2026-01-01T00:00:00Z')
  sleeps: Date[] = []
  /** Called during sleepUntil; may advance time or abort. */
  onSleep: (t: Date) => void = () => {}
  now(): Date {
    return new Date(this.t)
  }
  async sleepUntil(t: Date, signal: AbortSignal): Promise<void> {
    this.sleeps.push(t)
    this.onSleep(t)
    if (signal.aborted) return
    // Wait only if the target is still in the future (fake time: jump there).
    if (this.t < t.getTime()) this.t = t.getTime()
  }
}

function setup(opts: {
  reveal?: (k: HumbleKey) => Promise<string | null>
  register?: (key: string) => Promise<number>
  initial?: KeyRecord[]
  onEvent?: (e: RunEvent, runner: RedeemRunner) => void
}): {
  clock: FakeClock
  log: string[]
  records: Map<string, KeyRecord>
  events: RunEvent[]
  runner: RedeemRunner
} {
  const clock = new FakeClock()
  const log: string[] = []
  const records = new Map<string, KeyRecord>((opts.initial ?? []).map((r) => [r.id, r]))
  const events: RunEvent[] = []
  const runner = new RedeemRunner({
    reveal: async (k) => {
      log.push(`reveal:${k.id}`)
      return opts.reveal ? opts.reveal(k) : GOOD(k.keyindex)
    },
    register: async (key) => {
      log.push(`register:${key}`)
      return opts.register ? opts.register(key) : 0
    },
    store: {
      get: (id) => records.get(id),
      upsert: async (r) => {
        log.push(`upsert:${r.id}:${r.outcome}`)
        records.set(r.id, r)
      }
    },
    clock,
    onEvent: (e) => {
      events.push(e)
      opts.onEvent?.(e, runner)
    }
  })
  return { clock, log, records, events, runner }
}

describe('RedeemRunner', () => {
  it('counts the happy path and emits events in order', async () => {
    const { runner, events, records } = setup({
      register: async (key) => (key === GOOD(2) ? 9 : key === GOOD(3) ? 14 : 0)
    })
    const summary = await runner.run([mkKey(1), mkKey(2), mkKey(3)], 'run1')
    expect(summary).toEqual({ redeemed: 1, owned: 1, errors: 1, remaining: 0 })
    expect(events.map((e) => e.type)).toEqual([
      'key-start',
      'revealing',
      'key-done',
      'key-start',
      'revealing',
      'key-done',
      'key-start',
      'revealing',
      'key-done',
      'finished'
    ])
    const rec = records.get(mkKey(1).id)!
    expect(rec).toMatchObject({
      name: 'Game 1',
      steamAppId: 1001,
      runId: 'run1',
      outcome: 'redeemed',
      resultCode: 0,
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
  })

  it('persists the revealed key as pending before calling Steam', async () => {
    const { runner, log } = setup({})
    await runner.run([mkKey(1)], 'r')
    expect(log).toEqual([
      `reveal:${mkKey(1).id}`,
      `upsert:${mkKey(1).id}:pending`,
      `register:${GOOD(1)}`,
      `upsert:${mkKey(1).id}:redeemed`
    ])
  })

  it('records a null reveal as error -1 and continues', async () => {
    const { runner, records } = setup({
      reveal: async (k) => (k.keyindex === 1 ? null : GOOD(k.keyindex))
    })
    const summary = await runner.run([mkKey(1), mkKey(2)], 'r')
    expect(records.get(mkKey(1).id)).toMatchObject({ outcome: 'error', resultCode: -1 })
    expect(records.get(mkKey(2).id)?.outcome).toBe('redeemed')
    expect(summary).toEqual({ redeemed: 1, owned: 0, errors: 1, remaining: 0 })
  })

  it('persists a pre-revealed key as pending before calling Steam', async () => {
    const { runner, log } = setup({})
    await runner.run([mkKey(1, GOOD(1))], 'r')
    expect(log).toEqual([
      `upsert:${mkKey(1).id}:pending`,
      `register:${GOOD(1)}`,
      `upsert:${mkKey(1).id}:redeemed`
    ])
  })

  it('records a malformed key as error -2 without calling Steam', async () => {
    const { runner, records, log } = setup({ reveal: async () => 'not a key' })
    await runner.run([mkKey(1)], 'r')
    expect(records.get(mkKey(1).id)).toMatchObject({ outcome: 'error', resultCode: -2 })
    expect(log.some((l) => l.startsWith('register'))).toBe(false)
  })

  it('reuses a key revealed in an earlier run without revealing again', async () => {
    const stored: KeyRecord = {
      id: mkKey(1).id,
      name: 'Game 1',
      steamAppId: 1001,
      revealedKey: GOOD(1),
      outcome: 'pending',
      resultCode: null,
      runId: 'old',
      updatedAt: 'x'
    }
    const { runner, log } = setup({ initial: [stored] })
    await runner.run([mkKey(1)], 'r')
    expect(log.some((l) => l.startsWith('reveal'))).toBe(false)
    expect(log).toContain(`register:${GOOD(1)}`)
  })

  it('skips keys already stored as redeemed or owned', async () => {
    const mk = (k: HumbleKey, outcome: KeyRecord['outcome']): KeyRecord => ({
      id: k.id,
      name: k.name,
      steamAppId: k.steamAppId,
      revealedKey: GOOD(k.keyindex),
      outcome,
      resultCode: 0,
      runId: 'old',
      updatedAt: 'x'
    })
    const { runner, log, events } = setup({
      initial: [mk(mkKey(1), 'redeemed'), mk(mkKey(2), 'owned')]
    })
    const summary = await runner.run([mkKey(1), mkKey(2)], 'r')
    expect(log).toEqual([])
    expect(events.map((e) => e.type)).toEqual(['finished'])
    expect(summary).toEqual({ redeemed: 0, owned: 0, errors: 0, remaining: 0 })
  })

  it('waits an hour after code 53, then retries', async () => {
    let calls = 0
    const { runner, clock, events } = setup({ register: async () => (calls++ === 0 ? 53 : 0) })
    const start = clock.t
    const summary = await runner.run([mkKey(1)], 'r')
    const limited = events.filter((e) => e.type === 'rate-limited')
    expect(limited).toEqual([
      {
        type: 'rate-limited',
        id: mkKey(1).id,
        resumeAt: new Date(start + HOUR).toISOString(),
        attempt: 1
      }
    ])
    expect(summary.redeemed).toBe(1)
  })

  it('keeps retrying with an increasing attempt counter', async () => {
    let calls = 0
    const { runner, events } = setup({ register: async () => (calls++ < 2 ? 53 : 0) })
    await runner.run([mkKey(1)], 'r')
    expect(events.flatMap((e) => (e.type === 'rate-limited' ? [e.attempt] : []))).toEqual([1, 2])
  })

  it('resumes immediately when the clock jumps past resumeAt during the sleep', async () => {
    let calls = 0
    const { runner, clock } = setup({ register: async () => (calls++ === 0 ? 53 : 0) })
    clock.onSleep = () => {
      clock.t += 2 * HOUR
    }
    const summary = await runner.run([mkKey(1)], 'r')
    expect(clock.sleeps).toHaveLength(1)
    expect(summary.redeemed).toBe(1)
  })

  it('stops on Steam sign-out, leaving the record pending and later keys untouched', async () => {
    const { runner, records, events, log } = setup({
      register: async () => {
        throw new SessionExpiredError('steam')
      }
    })
    const summary = await runner.run([mkKey(1), mkKey(2)], 'r')
    expect(records.get(mkKey(1).id)).toMatchObject({ outcome: 'pending', revealedKey: GOOD(1) })
    expect(records.has(mkKey(2).id)).toBe(false)
    expect(log.filter((l) => l.startsWith('reveal'))).toHaveLength(1)
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'steam-signed-out' })
    expect(summary.remaining).toBe(2)
  })

  it('stops on Humble sign-out during reveal', async () => {
    const { runner, records, events } = setup({
      reveal: async () => {
        throw new SessionExpiredError('humble')
      }
    })
    await runner.run([mkKey(1)], 'r')
    expect(records.size).toBe(0)
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'humble-signed-out' })
  })

  it('stop() during the rate-limit sleep stops with reason user', async () => {
    const { runner, clock, events, records } = setup({ register: async () => 53 })
    clock.onSleep = () => runner.stop()
    const summary = await runner.run([mkKey(1), mkKey(2)], 'r')
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'user' })
    expect(records.get(mkKey(1).id)?.outcome).toBe('pending')
    expect(summary).toEqual({ redeemed: 0, owned: 0, errors: 0, remaining: 2 })
  })

  it('stop() between keys stops before the next key', async () => {
    const { runner, events, records } = setup({
      onEvent: (e, r) => {
        if (e.type === 'key-done') r.stop()
      }
    })
    const summary = await runner.run([mkKey(1), mkKey(2)], 'r')
    expect(summary).toEqual({ redeemed: 1, owned: 0, errors: 0, remaining: 1 })
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'user' })
    expect(records.has(mkKey(2).id)).toBe(false)
  })
})

describe('systemClock.sleepUntil (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function settled(p: Promise<void>): Promise<boolean> {
    let done = false
    p.then(
      () => (done = true),
      () => (done = true)
    )
    await vi.advanceTimersByTimeAsync(0)
    return done
  }

  it('resumes within one 30 s chunk after the wall clock jumps past the target', async () => {
    vi.useFakeTimers()
    const start = Date.now()
    const p = systemClock.sleepUntil(new Date(start + HOUR), new AbortController().signal)
    vi.setSystemTime(start + 2 * HOUR)
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(p).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits the full duration on a normal clock', async () => {
    vi.useFakeTimers()
    const p = systemClock.sleepUntil(new Date(Date.now() + HOUR), new AbortController().signal)
    await vi.advanceTimersByTimeAsync(59 * 60_000)
    expect(await settled(p)).toBe(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await settled(p)).toBe(true)
  })

  it('rejects on abort after the first chunk and leaves no timers', async () => {
    vi.useFakeTimers()
    const ac = new AbortController()
    const p = systemClock.sleepUntil(new Date(Date.now() + HOUR), ac.signal)
    const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(31_000)
    ac.abort()
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('systemClock.sleepUntil', () => {
  it('resolves immediately for a past time', async () => {
    await systemClock.sleepUntil(new Date(Date.now() - 1000), new AbortController().signal)
  })

  it('rejects with AbortError on abort', async () => {
    const ac = new AbortController()
    const p = systemClock.sleepUntil(new Date(Date.now() + HOUR), ac.signal)
    ac.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
