import { z } from 'zod'
import { parseRegisterKeyResponse } from '../../core/steamCodes'
import { ServiceChangedError, SessionExpiredError } from '../../shared/errors'
import type { OwnedData } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import type { OwnedNamesSource } from './ownedNames'

const STORE = 'https://store.steampowered.com'
const POST_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json, text/javascript, */*; q=0.01'
}

const userdataSchema = z
  .object({
    rgOwnedApps: z.array(z.number()).optional(),
    rgOwnedPackages: z.array(z.number()).optional()
  })
  .passthrough()

export class SteamApi {
  constructor(
    private readonly http: HttpClient,
    private readonly names: OwnedNamesSource
  ) {}

  async getOwned(): Promise<OwnedData> {
    const res = await this.http.get(`${STORE}/dynamicstore/userdata/`)
    if (
      res.status === 0 ||
      (res.status >= 300 && res.status < 400) ||
      res.status === 401 ||
      res.status === 403
    ) {
      throw new SessionExpiredError('steam')
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`steam userdata returned HTTP ${res.status}`)
    }
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
    if (ids.size === 0 && !('rgOwnedApps' in parsed.data)) {
      throw new ServiceChangedError('steam', 'userdata')
    }

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
