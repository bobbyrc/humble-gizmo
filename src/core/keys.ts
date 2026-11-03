import type { HumbleKey } from '../shared/types'

const STEAM_KEY_FORMAT = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i

type JsonObject = Record<string, unknown>

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function toKey(o: JsonObject): HumbleKey | null {
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
    isExpired: o.is_expired === true
  }
}

// Walks every array and object at any depth. An object that qualifies as a key
// is recorded and still walked into. The first occurrence of an id wins.
function walk(node: unknown, found: Map<string, HumbleKey>): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found)
    return
  }
  if (!isPlainObject(node)) return
  const key = toKey(node)
  if (key && !found.has(key.id)) found.set(key.id, key)
  for (const value of Object.values(node)) walk(value, found)
}

export function extractKeys(orders: unknown[]): HumbleKey[] {
  const found = new Map<string, HumbleKey>()
  walk(orders, found)
  return Array.from(found.values())
}

export function steamKeys(keys: HumbleKey[]): HumbleKey[] {
  return keys.filter((k) => k.isSteam)
}

export function isValidSteamKeyFormat(s: string | null): boolean {
  return s !== null && STEAM_KEY_FORMAT.test(s)
}
