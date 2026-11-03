import { describe, expect, it, vi } from 'vitest'
import { hardenSession } from '../../src/main/net/hardenSession'

describe('hardenSession', () => {
  it('disables spellcheck and denies every permission request and check', () => {
    const ses = {
      setSpellCheckerEnabled: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn()
    }
    hardenSession(ses as never)
    expect(ses.setSpellCheckerEnabled).toHaveBeenCalledWith(false)
    const cb = vi.fn()
    ses.setPermissionRequestHandler.mock.calls[0][0](null, 'media', cb)
    expect(cb).toHaveBeenCalledWith(false)
    expect(ses.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false)
  })
})
