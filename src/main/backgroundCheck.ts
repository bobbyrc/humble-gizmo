import { SessionExpiredError } from '../shared/errors'

/** Handlers hide error details behind a marker for IPC; recover the one case we act on. */
export function unwrapIpcError(e: unknown): unknown {
  const msg = e instanceof Error ? e.message : ''
  const at = msg.indexOf('GIZMO_ERR:')
  if (at < 0) return e
  try {
    const info = JSON.parse(msg.slice(at + 'GIZMO_ERR:'.length)) as {
      name?: string
      service?: string | null
    }
    if (
      info.name === 'SessionExpiredError' &&
      (info.service === 'humble' || info.service === 'steam')
    ) {
      return new SessionExpiredError(info.service)
    }
  } catch {
    // fall through
  }
  return e
}

/**
 * Builds the scheduler's check(): the number of will_redeem ids not seen in the previous check.
 * The first check only records a baseline. It only reads; it never reveals or redeems.
 */
export function createBackgroundCheck(deps: {
  isRunActive(): boolean
  peekWillRedeemIds(): Promise<string[]>
}): { check: () => Promise<number>; reset: () => void } {
  let seen: Set<string> | null = null
  const check = async (): Promise<number> => {
    if (deps.isRunActive()) return 0
    let ids: string[]
    try {
      ids = await deps.peekWillRedeemIds()
    } catch (e) {
      throw unwrapIpcError(e)
    }
    // A run that started meanwhile changes record state, so this snapshot may be stale.
    if (deps.isRunActive()) return 0
    const current = new Set(ids)
    const previous = seen
    seen = current
    if (previous === null) return 0
    let fresh = 0
    for (const id of current) if (!previous.has(id)) fresh++
    return fresh
  }
  /** Forget the baseline (data was deleted or the account changed): the next check re-baselines. */
  const reset = (): void => {
    seen = null
  }
  return { check, reset }
}
