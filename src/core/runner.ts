import { isValidSteamKeyFormat } from './keys'
import { BAD_FORMAT, RATE_LIMITED, REVEAL_FAILED, outcomeForCode } from './steamCodes'
import { SessionExpiredError } from '../shared/errors'
import type { HumbleKey, KeyRecord, RunEvent, RunSummary } from '../shared/types'

export type Clock = {
  now(): Date
  /**
   * Resolves once the wall clock reaches `t`. On abort an implementation may
   * reject (systemClock rejects with an AbortError) or resolve; the runner
   * checks `signal.aborted` afterwards and treats it as a stop either way.
   */
  sleepUntil(t: Date, signal: AbortSignal): Promise<void>
}

const MAX_CHUNK_MS = 30_000

/**
 * Real clock. Sleeps in chunks of at most 30 s, re-reading Date.now() each
 * time, so a suspended laptop resumes promptly after wake. Rejects with an
 * AbortError when the signal aborts.
 */
export const systemClock: Clock = {
  now: () => new Date(),
  sleepUntil(t, signal) {
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const onAbort = (): void => {
        clearTimeout(timer)
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      }
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
      const tick = (): void => {
        const left = t.getTime() - Date.now()
        if (left <= 0) {
          signal.removeEventListener('abort', onAbort)
          resolve()
          return
        }
        timer = setTimeout(tick, Math.min(left, MAX_CHUNK_MS))
      }
      tick()
    })
  }
}

export type RunnerDeps = {
  reveal: (k: HumbleKey) => Promise<string | null>
  register: (key: string) => Promise<number>
  store: { get(id: string): KeyRecord | undefined; upsert(r: KeyRecord): Promise<void> }
  clock: Clock
  rateLimitWaitMs?: number
  onEvent: (e: RunEvent) => void
}

type StopReason = 'user' | 'steam-signed-out' | 'humble-signed-out'

export class RedeemRunner {
  private controller = new AbortController()

  constructor(private deps: RunnerDeps) {}

  stop(): void {
    this.controller.abort()
  }

  async run(keys: HumbleKey[], runId: string): Promise<RunSummary> {
    const { store, clock, onEvent } = this.deps
    const waitMs = this.deps.rateLimitWaitMs ?? 3_600_000
    this.controller = new AbortController()
    const signal = this.controller.signal
    const summary: RunSummary = { redeemed: 0, owned: 0, errors: 0, remaining: 0 }

    const persist = (
      key: HumbleKey,
      revealedKey: string | null,
      outcome: KeyRecord['outcome'],
      resultCode: number | null
    ): Promise<void> =>
      store.upsert({
        id: key.id,
        name: key.name,
        steamAppId: key.steamAppId,
        revealedKey,
        outcome,
        resultCode,
        runId,
        updatedAt: clock.now().toISOString()
      })

    const finishKey = async (
      key: HumbleKey,
      revealedKey: string | null,
      code: number
    ): Promise<void> => {
      const outcome = outcomeForCode(code)
      await persist(key, revealedKey, outcome, code)
      if (outcome === 'redeemed') summary.redeemed++
      else if (outcome === 'owned') summary.owned++
      else summary.errors++
      onEvent({ type: 'key-done', id: key.id, outcome, code })
    }

    // A stopped run emits `stopped` (not `finished`) and returns its summary.
    const stopWith = (index: number, reason: StopReason): RunSummary => {
      summary.remaining = keys.length - index
      onEvent({ type: 'stopped', reason })
      return summary
    }

    for (let i = 0; i < keys.length; i++) {
      if (signal.aborted) return stopWith(i, 'user')
      const key = keys[i]
      const stored = store.get(key.id)
      // Defence in depth: the review list normally excludes these.
      if (stored && (stored.outcome === 'redeemed' || stored.outcome === 'owned')) continue

      onEvent({ type: 'key-start', id: key.id })
      try {
        let revealed = key.revealedKey ?? stored?.revealedKey ?? null
        if (!revealed) {
          onEvent({ type: 'revealing', id: key.id })
          revealed = await this.deps.reveal(key)
          if (revealed === null) {
            await finishKey(key, null, REVEAL_FAILED)
            continue
          }
          // Durable before Steam is called: a crash must never lose a revealed key.
          await persist(key, revealed, 'pending', null)
        }
        if (!isValidSteamKeyFormat(revealed)) {
          await finishKey(key, revealed, BAD_FORMAT)
          continue
        }

        let code = await this.deps.register(revealed)
        let attempt = 0
        while (code === RATE_LIMITED) {
          attempt++
          const resumeAt = new Date(clock.now().getTime() + waitMs)
          onEvent({ type: 'rate-limited', id: key.id, resumeAt: resumeAt.toISOString(), attempt })
          try {
            await clock.sleepUntil(resumeAt, signal)
          } catch (err) {
            if (!signal.aborted) throw err
          }
          if (signal.aborted) return stopWith(i, 'user')
          code = await this.deps.register(revealed)
        }
        await finishKey(key, revealed, code)
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          // The record (if any) stays pending so the next run picks it up.
          return stopWith(i, err.service === 'steam' ? 'steam-signed-out' : 'humble-signed-out')
        }
        throw err
      }
    }

    onEvent({ type: 'finished', summary })
    return summary
  }
}
