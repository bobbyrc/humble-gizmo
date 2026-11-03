import { SessionExpiredError } from '../shared/errors'
import type { Service } from '../shared/types'

export type SchedulerOptions = {
  getHours(): number | null
  /** Count of will_redeem keys not seen in the previous check. Must never redeem or reveal. */
  check(): Promise<number>
  notify(n: number): void
  notifySignedOut(s: Service): void
  setTimer: typeof setTimeout
  clearTimer?: typeof clearTimeout
}

export function startScheduler(opts: SchedulerOptions): { stop(): void; reschedule(): void } {
  const clear = opts.clearTimer ?? clearTimeout
  let handle: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  // Bumped on every (re)arm so a check that finishes after a reschedule does not arm a second timer.
  let generation = 0

  const disarm = (): void => {
    if (handle !== undefined) clear(handle)
    handle = undefined
  }

  const tick = async (mine: number): Promise<void> => {
    try {
      const n = await opts.check()
      if (n > 0) opts.notify(n)
    } catch (e) {
      if (e instanceof SessionExpiredError) opts.notifySignedOut(e.service)
      // other failures (network, rate limits) are retried at the next interval
    } finally {
      if (!stopped && generation === mine) arm()
    }
  }

  const arm = (): void => {
    disarm()
    const hours = opts.getHours()
    if (stopped || hours === null || !(hours > 0)) return
    const mine = ++generation
    handle = opts.setTimer(
      () => {
        handle = undefined
        void tick(mine)
      },
      hours * 3600 * 1000
    )
  }

  arm()
  return {
    stop: () => {
      stopped = true
      generation++
      disarm()
    },
    reschedule: () => {
      if (stopped) return
      generation++
      arm()
    }
  }
}
