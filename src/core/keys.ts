import type { HumbleKey } from '../shared/types'

const STEAM_KEY_FORMAT = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i

type JsonObject = Record<string, unknown>

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

type OrderContext = { bundle?: string; purchased?: string }

function toKey(o: JsonObject, ctx: OrderContext): HumbleKey | null {
  const { machine_name, gamekey, keyindex, key_type_human_name } = o
  if (
    typeof machine_name !== 'string' ||
    typeof gamekey !== 'string' ||
    typeof keyindex !== 'number' ||
    typeof key_type_human_name !== 'string'
  ) {
    return null
  }
  const appId = o.steam_app_id
  const revealed = o.redeemed_key_val
  return {
    id: `${gamekey}:${keyindex}:${machine_name}`,
    gamekey,
    keyindex,
    machineName: machine_name,
    name: typeof o.human_name === 'string' ? o.human_name.trim() : '',
    keyTypeName: key_type_human_name,
    isSteam: Object.prototype.hasOwnProperty.call(o, 'steam_app_id'),
    steamAppId: typeof appId === 'number' && appId !== 0 ? appId : null,
    revealedKey: typeof revealed === 'string' && revealed !== '' ? revealed : null,
    isGift: o.is_gift === true,
    isExpired: o.is_expired === true,
    ...(ctx.bundle !== undefined ? { bundle: ctx.bundle } : {}),
    ...(ctx.purchased !== undefined ? { purchased: ctx.purchased } : {})
  }
}

// Bundle name and purchase date come from the top-level order, not the key itself.
function orderContext(order: unknown): OrderContext {
  if (!isPlainObject(order)) return {}
  const ctx: OrderContext = {}
  const product = order.product
  if (isPlainObject(product) && typeof product.human_name === 'string') {
    const bundle = product.human_name.trim()
    if (bundle !== '') ctx.bundle = bundle
  }
  const created = order.created
  if (typeof created === 'string' && created !== '') ctx.purchased = created
  return ctx
}

// Walks every array and object at any depth. An object that qualifies as a key
// is recorded and still walked into. The first occurrence of an id wins.
function walk(node: unknown, found: Map<string, HumbleKey>, ctx: OrderContext): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found, ctx)
    return
  }
  if (!isPlainObject(node)) return
  const key = toKey(node, ctx)
  if (key && !found.has(key.id)) found.set(key.id, key)
  for (const value of Object.values(node)) walk(value, found, ctx)
}

export function extractKeys(orders: unknown[]): HumbleKey[] {
  const found = new Map<string, HumbleKey>()
  for (const order of orders) walk(order, found, orderContext(order))
  return Array.from(found.values())
}

export function steamKeys(keys: HumbleKey[]): HumbleKey[] {
  return keys.filter((k) => k.isSteam)
}

export function isValidSteamKeyFormat(s: string | null): boolean {
  return s !== null && STEAM_KEY_FORMAT.test(s)
}
