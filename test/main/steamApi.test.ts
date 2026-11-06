import { describe, expect, it } from 'vitest'
import type { HttpClient } from '../../src/main/net/httpClient'
import {
  WebTokenOwnedNames,
  createOwnedNamesSource,
  type OwnedNamesSource
} from '../../src/main/steam/ownedNames'
import { SteamApi } from '../../src/main/steam/steamApi'
import { loginTokenExpired, steamIdFromLoginCookie } from '../../src/main/steam/steamId'
import { ServiceChangedError, SessionExpiredError } from '../../src/shared/errors'

type Res = { status: number; body: string }
type Call = { method: 'GET' | 'POST'; url: string; form?: [string, string][] }

const STORE = 'https://store.steampowered.com'
const ID = '76561198000000001'

class FakeHttp implements HttpClient {
  calls: Call[] = []
  cookies: Record<string, string | undefined> = {
    sessionid: 'sess-1',
    steamLoginSecure: `${ID}%7C%7Cjwt`
  }
  constructor(private handler: (call: Call) => Res) {}
  async get(url: string): Promise<Res> {
    const call: Call = { method: 'GET', url }
    this.calls.push(call)
    return this.handler(call)
  }
  async postForm(url: string, form: [string, string][]): Promise<Res> {
    const call: Call = { method: 'POST', url, form }
    this.calls.push(call)
    return this.handler(call)
  }
  async getCookie(_url: string, name: string): Promise<string | undefined> {
    return this.cookies[name]
  }
}

const ok = (body: unknown): Res => ({ status: 200, body: JSON.stringify(body) })
const names = (m: [number, string][]): OwnedNamesSource => ({ fetch: async () => new Map(m) })
const failing = (e: unknown): OwnedNamesSource => ({
  fetch: async () => {
    throw e
  }
})

describe('steamIdFromLoginCookie', () => {
  it('reads both separators', () => {
    expect(steamIdFromLoginCookie(`${ID}%7C%7Cabc`)).toBe(ID)
    expect(steamIdFromLoginCookie(`${ID}||abc`)).toBe(ID)
  })
  it('returns null otherwise', () => {
    expect(steamIdFromLoginCookie('garbage')).toBeNull()
    expect(steamIdFromLoginCookie('')).toBeNull()
  })
})

const jwt = (exp: number): string =>
  `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`
const NOW = Date.UTC(2026, 10, 5)
const loginCookie = (expSec: number): string => `${ID}%7C%7C${jwt(expSec)}`

describe('loginTokenExpired', () => {
  it('is true for a past or nearly past exp and false for a later one', () => {
    expect(loginTokenExpired(loginCookie(NOW / 1000 - 1), NOW)).toBe(true)
    expect(loginTokenExpired(loginCookie(NOW / 1000 + 30), NOW)).toBe(true)
    expect(loginTokenExpired(loginCookie(NOW / 1000 + 3600), NOW)).toBe(false)
    expect(loginTokenExpired(`${ID}||${jwt(NOW / 1000 + 3600)}`, NOW)).toBe(false)
  })
  it('treats an unreadable token as unexpired', () => {
    for (const v of [`${ID}%7C%7Cjwt`, 'garbage', '%E0%A4%A', `${ID}||a.b.c`]) {
      expect(loginTokenExpired(v, NOW)).toBe(false)
    }
  })
})

describe('SteamApi expired login token', () => {
  const expired = loginCookie(Date.now() / 1000 - 60)
  const fresh = loginCookie(Date.now() / 1000 + 3600)

  it('refreshes the session and then reads userdata', async () => {
    const http = new FakeHttp(() => ok({ rgOwnedApps: [7] }))
    http.cookies.steamLoginSecure = expired
    let refreshes = 0
    const refresh = async (): Promise<boolean> => {
      refreshes++
      http.cookies.steamLoginSecure = fresh
      return true
    }
    const owned = await new SteamApi(http, names([]), refresh).getOwned()
    expect(refreshes).toBe(1)
    expect([...owned.ids]).toEqual([7])
  })

  it('is session expired without a request when the refresh fails', async () => {
    const http = new FakeHttp(() => ok({ rgOwnedApps: [] }))
    http.cookies.steamLoginSecure = expired
    const api = new SteamApi(http, names([]), async () => false)
    await expect(api.getOwned()).rejects.toBeInstanceOf(SessionExpiredError)
    await expect(api.registerKey('K')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(http.calls).toHaveLength(0)
  })

  it('is session expired when the refresh reports success but the token is still old', async () => {
    const http = new FakeHttp(() => ok({ rgOwnedApps: [] }))
    http.cookies.steamLoginSecure = expired
    const api = new SteamApi(http, names([]), async () => true)
    await expect(api.getOwned()).rejects.toBeInstanceOf(SessionExpiredError)
    expect(http.calls).toHaveLength(0)
  })

  it('does not refresh a live token', async () => {
    const http = new FakeHttp(() => ok({ success: 1 }))
    http.cookies.steamLoginSecure = fresh
    let refreshes = 0
    const api = new SteamApi(http, names([]), async () => (refreshes++, true))
    expect(await api.registerKey('K')).toBe(0)
    expect(refreshes).toBe(0)
  })
})

describe('SteamApi.getOwned', () => {
  const userdata = (body: unknown) => () => ok(body)

  it('merges apps and packages', async () => {
    const http = new FakeHttp(userdata({ rgOwnedApps: [1, 2], rgOwnedPackages: [2, 3] }))
    const api = new SteamApi(http, names([[1, 'One']]))
    const owned = await api.getOwned()
    expect([...owned.ids].sort()).toEqual([1, 2, 3])
    expect(owned.names.get(1)).toBe('One')
    expect(http.calls[0].url).toBe(`${STORE}/dynamicstore/userdata/`)
  })

  it('returns empty names but keeps ids when the names source throws', async () => {
    const api = new SteamApi(new FakeHttp(userdata({ rgOwnedApps: [5] })), failing(new Error('x')))
    const owned = await api.getOwned()
    expect(owned.names.size).toBe(0)
    expect(owned.ids.has(5)).toBe(true)
  })

  it('accepts an explicitly empty rgOwnedApps', async () => {
    const api = new SteamApi(new FakeHttp(userdata({ rgOwnedApps: [] })), names([]))
    expect((await api.getOwned()).ids.size).toBe(0)
  })

  it('throws ServiceChangedError when rgOwnedApps is missing and nothing is owned', async () => {
    const api = new SteamApi(new FakeHttp(userdata({})), names([]))
    await expect(api.getOwned()).rejects.toBeInstanceOf(ServiceChangedError)
  })

  it('throws a plain Error (not session expired) on HTTP 500', async () => {
    const api = new SteamApi(new FakeHttp(() => ({ status: 500, body: '' })), names([]))
    const err = await api.getOwned().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(SessionExpiredError)
    expect(err).not.toBeInstanceOf(ServiceChangedError)
  })

  it('without a login cookie it is session expired and makes no request', async () => {
    for (const v of [undefined, 'garbage']) {
      const http = new FakeHttp(userdata({ rgOwnedApps: [] }))
      http.cookies.steamLoginSecure = v
      await expect(new SteamApi(http, names([])).getOwned()).rejects.toBeInstanceOf(
        SessionExpiredError
      )
      expect(http.calls).toHaveLength(0)
    }
  })

  it('rgOwnedPackages without an rgOwnedApps array is ServiceChangedError', async () => {
    const api = new SteamApi(new FakeHttp(userdata({ rgOwnedPackages: [1] })), names([]))
    await expect(api.getOwned()).rejects.toBeInstanceOf(ServiceChangedError)
  })

  it('throws ServiceChangedError on non-JSON', async () => {
    const api = new SteamApi(new FakeHttp(() => ({ status: 200, body: '<html>' })), names([]))
    await expect(api.getOwned()).rejects.toBeInstanceOf(ServiceChangedError)
  })

  it.each([0, 302, 401, 403])('status %i means session expired', async (status) => {
    const api = new SteamApi(new FakeHttp(() => ({ status, body: '' })), names([]))
    await expect(api.getOwned()).rejects.toBeInstanceOf(SessionExpiredError)
  })
})

describe('SteamApi.registerKey', () => {
  it('sends the exact form and returns 0 on success', async () => {
    const http = new FakeHttp(() => ok({ success: 1 }))
    const code = await new SteamApi(http, names([])).registerKey('AAAAA-BBBBB-CCCCC')
    expect(code).toBe(0)
    expect(http.calls[0].url).toBe(`${STORE}/account/ajaxregisterkey/`)
    expect(http.calls[0].form).toEqual([
      ['product_key', 'AAAAA-BBBBB-CCCCC'],
      ['sessionid', 'sess-1']
    ])
  })

  it('returns the Steam result code', async () => {
    const http = new FakeHttp(() => ok({ success: 2, purchase_result_details: 9 }))
    expect(await new SteamApi(http, names([])).registerKey('K')).toBe(9)
  })

  it('a 302 is session expired, not rate limited', async () => {
    const http = new FakeHttp(() => ({ status: 302, body: '' }))
    await expect(new SteamApi(http, names([])).registerKey('K')).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it('status 0 is session expired, not rate limited', async () => {
    const http = new FakeHttp(() => ({ status: 0, body: '' }))
    await expect(new SteamApi(http, names([])).registerKey('K')).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it('a missing sessionid cookie is session expired and sends nothing', async () => {
    const http = new FakeHttp(() => ok({ success: 1 }))
    http.cookies.sessionid = undefined
    await expect(new SteamApi(http, names([])).registerKey('K')).rejects.toBeInstanceOf(
      SessionExpiredError
    )
    expect(http.calls).toHaveLength(0)
  })
})

describe('WebTokenOwnedNames', () => {
  it('uses the token and steamid, mapping appid and name', async () => {
    const http = new FakeHttp((c) =>
      c.url.includes('ajaxgetasyncconfig')
        ? ok({ data: { webapi_token: 'tok' } })
        : ok({ response: { games: [{ appid: 10, name: 'Ten' }, { appid: 11 }] } })
    )
    const result = await new WebTokenOwnedNames(http).fetch()
    expect([...result]).toEqual([[10, 'Ten']])
    const u = new URL(http.calls[1].url)
    expect(u.origin + u.pathname).toBe(
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/'
    )
    expect(u.searchParams.get('access_token')).toBe('tok')
    expect(u.searchParams.get('steamid')).toBe(ID)
    expect(u.searchParams.get('include_appinfo')).toBe('1')
    expect(u.searchParams.get('include_played_free_games')).toBe('1')
  })

  it('throws ServiceChangedError without leaking the token when the config lacks it', async () => {
    const http = new FakeHttp(() => ok({ data: {} }))
    await expect(new WebTokenOwnedNames(http).fetch()).rejects.toBeInstanceOf(ServiceChangedError)
  })

  it('error messages carry no token or steamid', async () => {
    const http = new FakeHttp((c) =>
      c.url.includes('ajaxgetasyncconfig')
        ? ok({ data: { webapi_token: 'SECRET-TOKEN' } })
        : { status: 500, body: 'SECRET-TOKEN' }
    )
    const err = await new WebTokenOwnedNames(http).fetch().catch((e: Error) => e)
    expect((err as Error).message).not.toMatch(/SECRET-TOKEN|7656/)
  })

  it('a missing login cookie is session expired', async () => {
    const http = new FakeHttp(() => ok({ data: { webapi_token: 't' } }))
    http.cookies.steamLoginSecure = undefined
    await expect(new WebTokenOwnedNames(http).fetch()).rejects.toBeInstanceOf(SessionExpiredError)
  })
})

describe('createOwnedNamesSource', () => {
  it('reads names through the web token', async () => {
    const http = new FakeHttp((c) =>
      c.url.includes('ajaxgetasyncconfig')
        ? ok({ data: { webapi_token: 'tok' } })
        : ok({ response: { games: [{ appid: 1, name: 'A' }] } })
    )
    const result = await createOwnedNamesSource(http).fetch()
    expect(result.get(1)).toBe('A')
    expect(http.calls).toHaveLength(2)
  })
})
