import { SessionExpiredError } from '../shared/errors'
import type { Outcome } from '../shared/types'

export const RATE_LIMITED = 53
export const REVEAL_FAILED = -1
export const BAD_FORMAT = -2

// Codes where retrying the same key will not help.
export const TERMINAL_CODES = new Set([13, 14, 36, 50, BAD_FORMAT])

const nonZeroNumber = (value: unknown): number | null =>
  typeof value === 'number' && value !== 0 ? value : null

/**
 * Interprets a Steam registerkey response. Returns 0 on success, otherwise the
 * Steam result code (or RATE_LIMITED when no code can be found).
 * Throws SessionExpiredError when Steam is redirecting or refusing the session.
 */
export function parseRegisterKeyResponse(status: number, body: string): number {
  if (status === 0 || status === 401 || status === 403 || (status >= 300 && status < 400)) {
    throw new SessionExpiredError('steam')
  }

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return RATE_LIMITED
  }
  if (typeof json !== 'object' || json === null) return RATE_LIMITED

  const data = json as Record<string, unknown>
  if (data.success === 1) return 0

  const details = nonZeroNumber(data.purchase_result_details)
  if (details !== null) return details

  const receipt = data.purchase_receipt_info
  const receiptDetail =
    typeof receipt === 'object' && receipt !== null
      ? nonZeroNumber((receipt as Record<string, unknown>).result_detail)
      : null
  return receiptDetail ?? RATE_LIMITED
}

export function outcomeForCode(code: number): Exclude<Outcome, 'pending'> {
  if (code === 0) return 'redeemed'
  if (code === 9 || code === 15) return 'owned'
  return 'error'
}

export function isRetryableError(code: number): boolean {
  return !TERMINAL_CODES.has(code)
}

export const CODE_LABELS: Record<number, string> = {
  9: 'already owned',
  13: 'region locked',
  14: 'invalid key',
  15: 'used elsewhere',
  24: 'requires base game',
  36: 'requires PS3',
  50: 'wallet code',
  53: 'rate limited',
  [REVEAL_FAILED]: "couldn't reveal on Humble",
  [BAD_FORMAT]: 'not a Steam key'
}
