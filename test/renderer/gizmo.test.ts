import { describe, expect, it } from 'vitest'
import { errorName, errorService } from '../../src/renderer/gizmo'
import { bridgeError } from './mockGizmo'

describe('bridge error parsing', () => {
  it('reads name and service from a GIZMO_ERR: message', () => {
    const e = bridgeError('ServiceChangedError', 'steam')
    expect(e.name).toBe('Error')
    expect(errorName(e)).toBe('ServiceChangedError')
    expect(errorService(e)).toBe('steam')
  })

  it('returns a null service when absent', () => {
    expect(errorService(bridgeError('SessionExpiredError'))).toBeNull()
  })

  it('falls back to the error name for ordinary errors', () => {
    const e = Object.assign(new Error('boom'), { name: 'TypeError' })
    expect(errorName(e)).toBe('TypeError')
    expect(errorService(e)).toBeNull()
  })

  it('survives a malformed payload and non-errors', () => {
    expect(errorName(new Error('GIZMO_ERR:{nope'))).toBe('Error')
    expect(errorService(new Error('GIZMO_ERR:{nope'))).toBeNull()
    expect(errorName(null)).toBe('Error')
    expect(errorName('str')).toBe('Error')
  })
})
