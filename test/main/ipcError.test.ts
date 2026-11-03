import { describe, expect, it } from 'vitest'
import { toBridgeError } from '../../src/preload/ipcError'

describe('toBridgeError', () => {
  it('re-emits name and service in the message, which is all contextBridge keeps', () => {
    const e = toBridgeError(
      new Error(
        'Error invoking remote method \'gizmo:x\': Error: GIZMO_ERR:{"name":"SessionExpiredError","service":"steam"}'
      )
    )
    expect(e.message).toBe('GIZMO_ERR:{"name":"SessionExpiredError","service":"steam"}')
  })

  it('keeps a null service', () => {
    expect(
      toBridgeError(new Error('GIZMO_ERR:{"name":"ServiceChangedError","service":null}')).message
    ).toBe('GIZMO_ERR:{"name":"ServiceChangedError","service":null}')
  })

  it('turns unknown or unparseable errors into a generic Error', () => {
    const generic = 'GIZMO_ERR:{"name":"Error","service":null}'
    expect(toBridgeError(new Error('boom')).message).toBe(generic)
    expect(toBridgeError('weird').message).toBe(generic)
    expect(toBridgeError(new Error('GIZMO_ERR:{oops')).message).toBe(generic)
  })
})
