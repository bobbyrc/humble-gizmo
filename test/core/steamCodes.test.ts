import { describe, expect, it } from 'vitest'
import { SessionExpiredError } from '../../src/shared/errors'
import {
  BAD_FORMAT,
  CODE_LABELS,
  RATE_LIMITED,
  REVEAL_FAILED,
  TERMINAL_CODES,
  isRetryableError,
  outcomeForCode,
  parseRegisterKeyResponse
} from '../../src/core/steamCodes'

describe('constants', () => {
  it('has the sentinel codes', () => {
    expect(RATE_LIMITED).toBe(53)
    expect(REVEAL_FAILED).toBe(-1)
    expect(BAD_FORMAT).toBe(-2)
  })

  it('has the terminal codes', () => {
    expect(TERMINAL_CODES).toEqual(new Set([13, 14, 36, 50, -2]))
  })
})

describe('parseRegisterKeyResponse', () => {
  it('returns 0 when success is 1', () => {
    expect(parseRegisterKeyResponse(200, JSON.stringify({ success: 1 }))).toBe(0)
  })

  it('returns purchase_result_details when non-zero', () => {
    expect(
      parseRegisterKeyResponse(200, JSON.stringify({ success: 0, purchase_result_details: 14 }))
    ).toBe(14)
  })

  it('falls through to purchase_receipt_info.result_detail when details is 0', () => {
    expect(
      parseRegisterKeyResponse(
        200,
        JSON.stringify({
          success: 0,
          purchase_result_details: 0,
          purchase_receipt_info: { result_detail: 9 }
        })
      )
    ).toBe(9)
  })

  it('falls through to purchase_receipt_info.result_detail when details is missing', () => {
    expect(
      parseRegisterKeyResponse(
        200,
        JSON.stringify({ success: 0, purchase_receipt_info: { result_detail: 15 } })
      )
    ).toBe(15)
  })

  it('returns 53 when no detail is present and success is not 1', () => {
    expect(parseRegisterKeyResponse(200, JSON.stringify({ success: 0 }))).toBe(53)
  })

  it('returns 53 when both details are 0 and success is not 1', () => {
    expect(
      parseRegisterKeyResponse(
        200,
        JSON.stringify({
          success: 0,
          purchase_result_details: 0,
          purchase_receipt_info: { result_detail: 0 }
        })
      )
    ).toBe(53)
  })

  it('returns 53 for a non-JSON body', () => {
    expect(parseRegisterKeyResponse(200, '<html>')).toBe(53)
  })

  it('returns 53 for a JSON value that is not an object', () => {
    expect(parseRegisterKeyResponse(200, 'null')).toBe(53)
    expect(parseRegisterKeyResponse(200, '5')).toBe(53)
  })

  it('throws SessionExpiredError on 401', () => {
    expect(() => parseRegisterKeyResponse(401, '')).toThrow(SessionExpiredError)
  })

  it('throws SessionExpiredError on 403', () => {
    expect(() => parseRegisterKeyResponse(403, '')).toThrow(SessionExpiredError)
  })

  it('throws SessionExpiredError on a 3xx status', () => {
    expect(() => parseRegisterKeyResponse(302, '')).toThrow(SessionExpiredError)
  })

  it('throws SessionExpiredError tagged with steam', () => {
    try {
      parseRegisterKeyResponse(302, '')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(SessionExpiredError)
      expect((e as SessionExpiredError).service).toBe('steam')
    }
  })
})

describe('outcomeForCode', () => {
  it('maps 0 to redeemed', () => {
    expect(outcomeForCode(0)).toBe('redeemed')
  })

  it('maps 9 and 15 to owned', () => {
    expect(outcomeForCode(9)).toBe('owned')
    expect(outcomeForCode(15)).toBe('owned')
  })

  it('maps anything else to error', () => {
    expect(outcomeForCode(14)).toBe('error')
    expect(outcomeForCode(53)).toBe('error')
    expect(outcomeForCode(-1)).toBe('error')
  })
})

describe('isRetryableError', () => {
  it('treats terminal codes as not retryable', () => {
    for (const code of [13, 14, 36, 50, -2]) {
      expect(isRetryableError(code)).toBe(false)
    }
  })

  it('treats other codes as retryable', () => {
    for (const code of [53, -1, 24, 15, 9]) {
      expect(isRetryableError(code)).toBe(true)
    }
  })
})

describe('CODE_LABELS', () => {
  it('has the expected labels', () => {
    expect(CODE_LABELS).toEqual({
      9: 'already owned',
      13: 'region locked',
      14: 'invalid key',
      15: 'used elsewhere',
      24: 'requires base game',
      36: 'requires PS3',
      50: 'wallet code',
      53: 'rate limited',
      [-1]: "couldn't reveal on Humble",
      [-2]: 'not a Steam key'
    })
  })
})
