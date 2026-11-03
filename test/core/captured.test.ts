import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildChoiceMonth, findChoiceOrders, type ChoiceOrder } from '../../src/core/choice'
import { extractKeys } from '../../src/core/keys'

const DIR = join(__dirname, '../fixtures/captured')
const hasFixtures = existsSync(DIR) && readdirSync(DIR).some((f) => f.endsWith('.json'))

const load = (name: string): unknown => {
  const path = join(DIR, name)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined
}

describe.skipIf(!hasFixtures)('captured fixtures', () => {
  it('extractKeys finds at least one key in orders.json', () => {
    const orders = load('orders.json')
    expect(Array.isArray(orders)).toBe(true)
    expect(extractKeys(orders as unknown[]).length).toBeGreaterThanOrEqual(1)
  })

  it('findChoiceOrders and buildChoiceMonth do not throw on choice-month.json', () => {
    const orders = load('orders.json')
    if (Array.isArray(orders)) expect(() => findChoiceOrders(orders)).not.toThrow()
    const options = load('choice-month.json')
    if (options === undefined) return
    const order: ChoiceOrder = {
      gamekey: 'FAKEGAMEKEY',
      name: 'Captured month',
      choiceUrl: 'captured',
      created: '',
      choicesRemaining: 1,
      isV3: false,
      chosenMachineNames: new Set()
    }
    expect(() => buildChoiceMonth(order, options)).not.toThrow()
  })

  it('userdata.json has an rgOwnedApps array', () => {
    const userdata = load('userdata.json') as { rgOwnedApps?: unknown } | undefined
    if (userdata === undefined) return
    expect(Array.isArray(userdata.rgOwnedApps)).toBe(true)
  })
})
