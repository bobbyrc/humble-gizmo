import { describe, expect, it } from 'vitest'
import { createBackgroundCheck, unwrapIpcError } from '../../src/main/backgroundCheck'
import { SessionExpiredError } from '../../src/shared/errors'

function setup(initial: string[][]): {
  check: () => Promise<number>
  state: { active: boolean; calls: number }
} {
  const queue = [...initial]
  const state = { active: false, calls: 0 }
  const check = createBackgroundCheck({
    isRunActive: () => state.active,
    peekWillRedeemIds: async () => {
      state.calls++
      return queue.shift() ?? []
    }
  })
  return { check, state }
}

describe('createBackgroundCheck', () => {
  it('records a baseline on the first check and returns 0', async () => {
    const t = setup([['a', 'b']])
    expect(await t.check()).toBe(0)
  })

  it('counts only ids not in the previous check', async () => {
    const t = setup([['a'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd'], ['d']])
    await t.check()
    expect(await t.check()).toBe(2)
    expect(await t.check()).toBe(1)
    expect(await t.check()).toBe(0)
  })

  it('skips while a run is active, without peeking or moving the baseline', async () => {
    const t = setup([['a'], ['a', 'b']])
    await t.check()
    t.state.active = true
    expect(await t.check()).toBe(0)
    expect(t.state.calls).toBe(1)
    t.state.active = false
    expect(await t.check()).toBe(1)
  })

  it('discards the result when a run started during the peek', async () => {
    const state = { active: false }
    const check = createBackgroundCheck({
      isRunActive: () => state.active,
      peekWillRedeemIds: async () => {
        state.active = true
        return ['x']
      }
    })
    expect(await check()).toBe(0)
    state.active = false
    // the baseline was never recorded, so this is still the first check
    expect(await check()).toBe(0)
  })

  it('turns a marked IPC error back into SessionExpiredError', async () => {
    const check = createBackgroundCheck({
      isRunActive: () => false,
      peekWillRedeemIds: async () => {
        throw new Error('GIZMO_ERR:{"name":"SessionExpiredError","service":"steam"}')
      }
    })
    await expect(check()).rejects.toBeInstanceOf(SessionExpiredError)
  })
})

describe('unwrapIpcError', () => {
  it('passes other errors through', () => {
    const e = new Error('boom')
    expect(unwrapIpcError(e)).toBe(e)
    const m = new Error('GIZMO_ERR:{"name":"ServiceChangedError","service":"humble"}')
    expect(unwrapIpcError(m)).toBe(m)
  })
})
