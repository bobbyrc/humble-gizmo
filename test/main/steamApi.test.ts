import { describe, expect, it } from 'vitest'
import type { HttpClient } from '../../src/main/net/httpClient'
import {
  ApiKeyOwnedNames,
  ChainOwnedNames,
  CommunityPageOwnedNames,
  WebTokenOwnedNames,
  createOwnedNamesSource,
  type OwnedNamesSource
} from '../../src/main/steam/ownedNames'
import { SteamApi } from '../../src/main/steam/steamApi'
import { steamIdFromLoginCookie } from '../../src/main/steam/steamId'
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

describe('CommunityPageOwnedNames', () => {
  const page = (attr: string): string =>
    `<html><div id="x" data-profile-gameslist="${attr}"></div></html>`
  const encoded = JSON.stringify({ rgGames: [{ appid: 7, name: 'Tom &amp; "Jerry"' }] })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')

  it('decodes the attribute and reads rgGames', async () => {
    const http = new FakeHttp(() => ({ status: 200, body: page(encoded) }))
    const result = await new CommunityPageOwnedNames(http).fetch()
    expect(result.get(7)).toBe('Tom &amp; "Jerry"')
    expect(http.calls[0].url).toBe(`https://steamcommunity.com/profiles/${ID}/games/?tab=all`)
  })

  it('throws ServiceChangedError when the attribute is absent', async () => {
    const http = new FakeHttp(() => ({ status: 200, body: '<html></html>' }))
    await expect(new CommunityPageOwnedNames(http).fetch()).rejects.toBeInstanceOf(
      ServiceChangedError
    )
  })

  it('throws ServiceChangedError when the attribute is not the expected JSON', async () => {
    const http = new FakeHttp(() => ({ status: 200, body: page('not json') }))
    await expect(new CommunityPageOwnedNames(http).fetch()).rejects.toBeInstanceOf(
      ServiceChangedError
    )
  })
})

describe('ApiKeyOwnedNames', () => {
  it('throws without a key and makes no request', async () => {
    const http = new FakeHttp(() => ok({}))
    await expect(new ApiKeyOwnedNames(http, () => null).fetch()).rejects.toThrow()
    expect(http.calls).toHaveLength(0)
  })

  it('queries with the key', async () => {
    const http = new FakeHttp(() => ok({ response: { games: [{ appid: 3, name: 'Three' }] } }))
    const result = await new ApiKeyOwnedNames(http, () => 'K3Y').fetch()
    expect(result.get(3)).toBe('Three')
    const u = new URL(http.calls[0].url)
    expect(u.searchParams.get('key')).toBe('K3Y')
    expect(u.searchParams.get('steamid')).toBe(ID)
    expect(u.searchParams.get('include_appinfo')).toBe('1')
  })
})

describe('ChainOwnedNames', () => {
  it('returns the first non-empty result', async () => {
    const chain = new ChainOwnedNames([
      failing(new Error('a')),
      names([]),
      names([[1, 'x']]),
      names([[2, 'y']])
    ])
    expect([...(await chain.fetch())]).toEqual([[1, 'x']])
  })

  it('throws the last error when all fail', async () => {
    const chain = new ChainOwnedNames([failing(new Error('first')), failing(new Error('last'))])
    await expect(chain.fetch()).rejects.toThrow('last')
  })

  it('createOwnedNamesSource falls through token to community page', async () => {
    const http = new FakeHttp((c) => {
      if (c.url.includes('ajaxgetasyncconfig')) return { status: 500, body: '' }
      const attr = JSON.stringify({ rgGames: [{ appid: 1, name: 'A' }] }).replace(/"/g, '&quot;')
      return { status: 200, body: `<div data-profile-gameslist="${attr}">` }
    })
    const result = await createOwnedNamesSource(http, () => null).fetch()
    expect(result.get(1)).toBe('A')
  })
})
