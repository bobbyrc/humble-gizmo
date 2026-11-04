// The repo is public: keep only the fields the captured-fixture tests read, so no personal data is saved.

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const DAY_MS = 86_400_000
const SYNTHETIC_EPOCH = Date.UTC(2015, 0, 1)

/** Zeroes amounts, drops path_ids and replaces dates with synthetic ones that keep the original order. */
export function trimOrders(orders: unknown[]): unknown[] {
  const dates = [...new Set(orders.filter(isRecord).map((o) => o.created))]
    .filter((c): c is string => typeof c === 'string')
    .sort()
  const synthetic = new Map(
    dates.map((c, i) => [c, new Date(SYNTHETIC_EPOCH + i * DAY_MS).toISOString()])
  )
  return orders.map((o) => {
    if (!isRecord(o)) return o
    const copy = structuredClone(o)
    if ('amount_spent' in copy) copy.amount_spent = 0
    if ('total' in copy) copy.total = 0
    delete copy.path_ids
    if (typeof copy.created === 'string') copy.created = synthetic.get(copy.created)
    return copy
  })
}

/** Keeps only the owned app and package lists from Steam's userdata. */
export function trimUserdata(raw: unknown): unknown {
  const data = isRecord(raw) ? raw : {}
  return {
    rgOwnedApps: Array.isArray(data.rgOwnedApps) ? structuredClone(data.rgOwnedApps) : [],
    rgOwnedPackages: Array.isArray(data.rgOwnedPackages)
      ? structuredClone(data.rgOwnedPackages)
      : []
  }
}

/** Keeps only appid and name per game from Steam's GetOwnedGames response. */
export function trimOwnedNames(raw: unknown): unknown {
  const response = isRecord(raw) && isRecord(raw.response) ? raw.response : {}
  const games = Array.isArray(response.games)
    ? response.games.filter(isRecord).map((g) => ({ appid: g.appid, name: g.name }))
    : []
  return {
    response: {
      game_count: typeof response.game_count === 'number' ? response.game_count : games.length,
      games
    }
  }
}
