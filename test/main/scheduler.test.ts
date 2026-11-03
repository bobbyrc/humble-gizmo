import { promises as fs } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { startScheduler } from '../../src/main/scheduler'
import { SessionExpiredError } from '../../src/shared/errors'

type FakeTimer = { fn: () => void; ms: number; cleared: boolean }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(hours: number | null, check: () => Promise<number>) {
  const timers: FakeTimer[] = []
  const setTimer = ((fn: () => void, ms: number) => {
    // a fired timer is no longer pending, like a real one
    const t: FakeTimer = {
      fn: () => {
        t.cleared = true
        fn()
      },
      ms,
      cleared: false
    }
    timers.push(t)
    return t
  }) as unknown as typeof setTimeout
  const clearTimer = ((t: FakeTimer) => {
    t.cleared = true
  }) as unknown as typeof clearTimeout
  const notify = vi.fn()
  const notifySignedOut = vi.fn()
  let h = hours
  const s = startScheduler({
    getHours: () => h,
    check,
    notify,
    notifySignedOut,
    setTimer,
    clearTimer
  })
  const live = (): FakeTimer[] => timers.filter((t) => !t.cleared)
  const flush = (): Promise<void> => new Promise((r) => setImmediate(r))
  return {
    s,
    timers,
    live,
    notify,
    notifySignedOut,
    flush,
    setHours: (x: number | null) => {
      h = x
    }
  }
}

describe('startScheduler', () => {
  it('sets no timer when hours is null', () => {
    const t = setup(null, async () => 0)
    expect(t.timers).toHaveLength(0)
  })

  it('sets a timer of hours * 3600 * 1000', () => {
    const t = setup(6, async () => 0)
    expect(t.timers.map((x) => x.ms)).toEqual([6 * 3600 * 1000])
  })

  it('does not notify when nothing is new, then re-arms', async () => {
    const t = setup(1, async () => 0)
    t.timers[0].fn()
    await t.flush()
    expect(t.notify).not.toHaveBeenCalled()
    expect(t.live()).toHaveLength(1)
  })

  it('notifies with the count of new keys', async () => {
    const t = setup(1, async () => 3)
    t.timers[0].fn()
    await t.flush()
    expect(t.notify).toHaveBeenCalledWith(3)
  })

  it('reports a signed-out service and keeps scheduling', async () => {
    const t = setup(1, async () => {
      throw new SessionExpiredError('steam')
    })
    t.timers[0].fn()
    await t.flush()
    expect(t.notifySignedOut).toHaveBeenCalledWith('steam')
    expect(t.notify).not.toHaveBeenCalled()
    expect(t.live()).toHaveLength(1)
  })

  it('swallows other errors and keeps scheduling', async () => {
    const t = setup(1, async () => {
      throw new Error('boom')
    })
    t.timers[0].fn()
    await t.flush()
    expect(t.notify).not.toHaveBeenCalled()
    expect(t.notifySignedOut).not.toHaveBeenCalled()
    expect(t.live()).toHaveLength(1)
  })

  it('stop clears the timer and prevents re-arming', async () => {
    const t = setup(1, async () => 0)
    t.timers[0].fn()
    t.s.stop()
    await t.flush()
    expect(t.live()).toHaveLength(0)
  })

  it('reschedule picks up new hours and replaces the old timer', () => {
    const t = setup(1, async () => 0)
    t.setHours(2)
    t.s.reschedule()
    expect(t.live().map((x) => x.ms)).toEqual([2 * 3600 * 1000])
    t.setHours(null)
    t.s.reschedule()
    expect(t.live()).toHaveLength(0)
  })

  it('clamps hours to [1, 24]', () => {
    expect(setup(0.001, async () => 0).timers[0].ms).toBe(3600 * 1000)
    expect(setup(1000, async () => 0).timers[0].ms).toBe(24 * 3600 * 1000)
  })

  it('never runs a second check while one is in flight', async () => {
    let calls = 0
    const t = setup(1, () => {
      calls++
      return new Promise<number>(() => undefined) // never settles
    })
    t.timers[0].fn()
    t.s.reschedule()
    t.live()[0].fn()
    await t.flush()
    expect(calls).toBe(1)
    expect(t.live()).toHaveLength(1) // re-armed for later
  })

  it('never imports or calls the runner', async () => {
    const src = await fs.readFile('src/main/scheduler.ts', 'utf8')
    expect(src).not.toMatch(/runner|startRun|revealKey|registerKey/i)
  })
})
