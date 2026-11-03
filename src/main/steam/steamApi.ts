import { z } from 'zod'
import { parseRegisterKeyResponse } from '../../core/steamCodes'
import { ServiceChangedError, SessionExpiredError } from '../../shared/errors'
import type { OwnedData } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import { steamIdFromLoginCookie } from './steamId'
import { checkOk, type OwnedNamesSource } from './ownedNames'

const STORE = 'https://store.steampowered.com'
const POST_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json, text/javascript, */*; q=0.01'
}

const userdataSchema = z
  .object({
    rgOwnedApps: z.array(z.number()),
    rgOwnedPackages: z.array(z.number()).optional()
  })
  .passthrough()

export class SteamApi {
  constructor(
    private readonly http: HttpClient,
    private readonly names: OwnedNamesSource
  ) {}

  async getOwned(): Promise<OwnedData> {
    // Logged-out userdata is HTTP 200 with empty arrays, which would make every key look unowned.
    const login = await this.http.getCookie(STORE, 'steamLoginSecure')
    if (!login || steamIdFromLoginCookie(login) === null) throw new SessionExpiredError('steam')
    const res = await this.http.get(`${STORE}/dynamicstore/userdata/`)
    checkOk(res, 'userdata')
    let raw: unknown
    try {
      raw = JSON.parse(res.body)
    } catch {
      throw new ServiceChangedError('steam', 'userdata')
    }
    const parsed = userdataSchema.safeParse(raw)
    if (!parsed.success) throw new ServiceChangedError('steam', 'userdata')
    const ids = new Set<number>([
      ...(parsed.data.rgOwnedApps ?? []),
      ...(parsed.data.rgOwnedPackages ?? [])
    ])

    let names = new Map<number, string>()
    try {
      names = await this.names.fetch()
    } catch {
      // Names are best-effort; ids alone are enough to detect ownership.
    }
    return { ids, names }
  }

  /** Redeems a key. Returns 0 on success, otherwise the Steam result code. */
  async registerKey(key: string): Promise<number> {
    const sessionId = await this.http.getCookie(STORE, 'sessionid')
    if (!sessionId) throw new SessionExpiredError('steam')
    const res = await this.http.postForm(
      `${STORE}/account/ajaxregisterkey/`,
      [
        ['product_key', key],
        ['sessionid', sessionId]
      ],
      POST_HEADERS
    )
    return parseRegisterKeyResponse(res.status, res.body)
  }
}
