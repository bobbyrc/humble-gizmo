import { z } from 'zod'
import { ServiceChangedError, SessionExpiredError } from '../../shared/errors'
import type { HttpClient } from '../net/httpClient'
import { steamIdFromLoginCookie } from './steamId'

/** Resolves appid -> game name for the signed-in user's library. */
export interface OwnedNamesSource {
  fetch(): Promise<Map<number, string>>
}

const STORE = 'https://store.steampowered.com'
const API = 'https://api.steampowered.com'

type Res = { status: number; body: string }

const configSchema = z
  .object({ data: z.object({ webapi_token: z.string().min(1) }).passthrough() })
  .passthrough()
const gameSchema = z.object({ appid: z.number(), name: z.string().optional() }).passthrough()
const ownedGamesSchema = z
  .object({ response: z.object({ games: z.array(gameSchema) }).passthrough() })
  .passthrough()

// Errors carry only the endpoint label: the URLs here can contain the token, steamid or key.
/** Throws SessionExpiredError for status 0 (opaque redirect), 3xx, 401, 403; a plain Error for other non-2xx. */
export function checkOk(res: Res, endpoint: string): void {
  if (
    res.status === 0 ||
    (res.status >= 300 && res.status < 400) ||
    res.status === 401 ||
    res.status === 403
  ) {
    throw new SessionExpiredError('steam')
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`steam ${endpoint} returned HTTP ${res.status}`)
  }
}

function parseJson<T>(body: string, schema: z.ZodType<T>, endpoint: string): T {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new ServiceChangedError('steam', endpoint)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new ServiceChangedError('steam', endpoint)
  return parsed.data
}

function toMap(games: { appid: number; name?: string }[]): Map<number, string> {
  const out = new Map<number, string>()
  for (const g of games) if (g.name) out.set(g.appid, g.name)
  return out
}

async function requireSteamId(http: HttpClient): Promise<string> {
  const cookie = await http.getCookie(STORE, 'steamLoginSecure')
  const id = cookie ? steamIdFromLoginCookie(cookie) : null
  if (!id) throw new SessionExpiredError('steam')
  return id
}

async function getOwnedGames(
  http: HttpClient,
  query: URLSearchParams,
  label: string
): Promise<Map<number, string>> {
  const res = await http.get(`${API}/IPlayerService/GetOwnedGames/v1/?${query.toString()}`)
  checkOk(res, label)
  return toMap(parseJson(res.body, ownedGamesSchema, label).response.games)
}

/** Short-lived web API token from the store page, used with the public Web API. */
export class WebTokenOwnedNames implements OwnedNamesSource {
  constructor(private readonly http: HttpClient) {}

  async fetch(): Promise<Map<number, string>> {
    const cfg = await this.http.get(`${STORE}/pointssummary/ajaxgetasyncconfig`)
    checkOk(cfg, 'web token config')
    const token = parseJson(cfg.body, configSchema, 'web token config').data.webapi_token
    const steamId = await requireSteamId(this.http)
    return getOwnedGames(
      this.http,
      new URLSearchParams({
        access_token: token,
        steamid: steamId,
        include_appinfo: '1',
        include_played_free_games: '1'
      }),
      'owned games (token)'
    )
  }
}

export function createOwnedNamesSource(http: HttpClient): OwnedNamesSource {
  return new WebTokenOwnedNames(http)
}
