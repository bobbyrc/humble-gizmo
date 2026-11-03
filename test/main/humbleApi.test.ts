import { describe, expect, it } from 'vitest'
import { HumbleApi } from '../../src/main/humble/humbleApi'
import type { HttpClient } from '../../src/main/net/httpClient'
import { ServiceChangedError, SessionExpiredError } from '../../src/shared/errors'
import type { HumbleKey } from '../../src/shared/types'
import type { ChoiceOrder } from '../../src/core/choice'

type Res = { status: number; body: string }
type Call = {
  method: 'GET' | 'POST'
  url: string
  form?: [string, string][]
  headers?: Record<string, string>
}

class FakeHttp implements HttpClient {
  calls: Call[] = []
  cookie: string | undefined = 'csrf-token-value'
  private counts = new Map<string, number>()
  constructor(private handler: (call: Call, n: number) => Res | Promise<Res>) {}
  private async run(call: Call): Promise<Res> {
    this.calls.push(call)
    const n = (this.counts.get(call.url) ?? 0) + 1
    this.counts.set(call.url, n)
    return this.handler(call, n)
  }
  get(url: string): Promise<Res> {
    return this.run({ method: 'GET', url })
  }
  postForm(url: string, form: [string, string][], headers?: Record<string, string>): Promise<Res> {
    return this.run({ method: 'POST', url, form, headers })
  }
  async getCookie(_url: string, name: string): Promise<string | undefined> {
    return name === 'csrf_cookie' ? this.cookie : undefined
  }
}

const json = (v: unknown, status = 200): Res => ({ status, body: JSON.stringify(v) })
const noSleep = async (): Promise<void> => {}
const ORDER_URL = 'https://www.humblebundle.com/api/v1/order/'
const key: HumbleKey = {
  id: 'gk:2:m',
  gamekey: 'gk',
  keyindex: 2,
  machineName: 'm',
  name: 'Game',
  keyTypeName: 'Steam',
  isSteam: true,
  steamAppId: 1,
  revealedKey: null,
  isGift: false,
  isExpired: false
}

describe('listOrderGamekeys', () => {
  it('returns gamekeys', async () => {
    const http = new FakeHttp(() => json([{ gamekey: 'a', extra: 1 }, { gamekey: 'b' }]))
    expect(await new HumbleApi(http).listOrderGamekeys()).toEqual(['a', 'b'])
    expect(http.calls[0].url).toBe('https://www.humblebundle.com/api/v1/user/order')
  })

  it('throws ServiceChangedError when the shape is wrong', async () => {
    const http = new FakeHttp(() => json({}))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      ServiceChangedError
    )
  })

  it('throws ServiceChangedError on non-JSON', async () => {
    const http = new FakeHttp(() => ({ status: 200, body: 'nope' }))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      ServiceChangedError
    )
  })

  it('treats a 302 as an expired session', async () => {
    const http = new FakeHttp(() => ({ status: 302, body: '' }))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it.each([401, 403])('treats %i as an expired session', async (status) => {
    const http = new FakeHttp(() => ({ status, body: '' }))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it('treats a 200 login page as an expired session', async () => {
    const http = new FakeHttp(() => ({
      status: 200,
      body: '<html><form action="/processlogin" method="post"></form></html>'
    }))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })
})

describe('getOrders', () => {
  const keys = Array.from({ length: 20 }, (_, i) => `k${i}`)

  it('keeps going when two orders fail every time', async () => {
    const http = new FakeHttp((call) => {
      if (call.url.includes('/k3?') || call.url.includes('/k11?')) return { status: 500, body: '' }
      return json({ gamekey: call.url.split('/').pop()!.split('?')[0] })
    })
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(keys)
    expect(r.orders).toHaveLength(18)
    expect(r.failed.sort()).toEqual(['k11', 'k3'])
  })

  it('retries a transient failure', async () => {
    const http = new FakeHttp((call, n) =>
      n === 1 ? { status: 500, body: '' } : json({ ok: call.url })
    )
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(['a'])
    expect(r.orders).toHaveLength(1)
    expect(r.failed).toEqual([])
  })

  it('backs off 2s times the attempt number', async () => {
    const waits: number[] = []
    const http = new FakeHttp(() => ({ status: 500, body: '' }))
    await new HumbleApi(http, { sleep: async (ms) => void waits.push(ms) }).getOrders(['a'])
    expect(waits).toEqual([2000, 4000])
    expect(http.calls).toHaveLength(3)
  })

  it('requests all_tpkds', async () => {
    const http = new FakeHttp(() => json({}))
    await new HumbleApi(http, { sleep: noSleep }).getOrders(['abc'])
    expect(http.calls[0].url).toBe(`${ORDER_URL}abc?all_tpkds=true`)
  })

  it('never runs more than the concurrency limit at once', async () => {
    let active = 0
    let peak = 0
    const http = new FakeHttp(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 1))
      active--
      return json({})
    })
    await new HumbleApi(http, { sleep: noSleep }).getOrders(keys, { concurrency: 4 })
    expect(peak).toBeLessThanOrEqual(4)
    expect(peak).toBeGreaterThan(1)
  })

  it('fails the whole fetch when the session has expired', async () => {
    const http = new FakeHttp(() => ({ status: 401, body: '' }))
    await expect(
      new HumbleApi(http, { sleep: noSleep }).getOrders(['a', 'b'], { concurrency: 1 })
    ).rejects.toBeInstanceOf(SessionExpiredError)
    expect(http.calls).toHaveLength(1)
  })
})

describe('opaque redirects and blocked hosts', () => {
  it('treats status 0 as an expired session', async () => {
    const http = new FakeHttp(() => ({ status: 0, body: '' }))
    await expect(new HumbleApi(http).listOrderGamekeys()).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })

  it('getOrders aborts on status 0 instead of listing failures', async () => {
    const http = new FakeHttp(() => ({ status: 0, body: '' }))
    await expect(
      new HumbleApi(http, { sleep: noSleep }).getOrders(['a', 'b'], { concurrency: 1 })
    ).rejects.toBeInstanceOf(SessionExpiredError)
    expect(http.calls).toHaveLength(1)
  })

  it('getOrders does not retry a blocked host error', async () => {
    const http = new FakeHttp(() => {
      throw new Error('blocked host: evil.example.com')
    })
    await expect(
      new HumbleApi(http, { sleep: noSleep }).getOrders(['a'], { concurrency: 1 })
    ).rejects.toThrow('blocked host')
    expect(http.calls).toHaveLength(1)
  })
})

describe('revealKey', () => {
  it('sends the exact form and headers and returns the key', async () => {
    const http = new FakeHttp(() => json({ success: true, key: 'AAAAA-BBBBB-CCCCC' }))
    expect(await new HumbleApi(http).revealKey(key)).toBe('AAAAA-BBBBB-CCCCC')
    const c = http.calls[0]
    expect(c.url).toBe('https://www.humblebundle.com/humbler/redeemkey')
    expect(c.form).toEqual([
      ['keytype', 'm'],
      ['key', 'gk'],
      ['keyindex', '2']
    ])
    expect(c.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'CSRF-Prevention-Token': 'csrf-token-value'
    })
  })

  it('returns null when success is false', async () => {
    const http = new FakeHttp(() => json({ success: false, error_msg: 'nope' }))
    expect(await new HumbleApi(http).revealKey(key)).toBeNull()
  })

  it('throws SessionExpiredError without a csrf cookie, and sends nothing', async () => {
    const http = new FakeHttp(() => json({ success: true, key: 'x' }))
    http.cookie = undefined
    await expect(new HumbleApi(http).revealKey(key)).rejects.toBeInstanceOf(SessionExpiredError)
    expect(http.calls).toHaveLength(0)
  })

  it('throws ServiceChangedError on a wrong shape', async () => {
    const http = new FakeHttp(() => json({ ok: 1 }))
    await expect(new HumbleApi(http).revealKey(key)).rejects.toBeInstanceOf(ServiceChangedError)
  })
})

describe('chooseContent', () => {
  it('sends the exact form and returns success', async () => {
    const http = new FakeHttp(() => json({ success: true }))
    expect(await new HumbleApi(http).chooseContent('gk', 'initial', 'game_x')).toBe(true)
    const c = http.calls[0]
    expect(c.url).toBe('https://www.humblebundle.com/humbler/choosecontent')
    expect(c.form).toEqual([
      ['gamekey', 'gk'],
      ['parent_identifier', 'initial'],
      ['chosen_identifiers[]', 'game_x'],
      ['is_multikey_and_from_choice_modal', 'false']
    ])
    expect(c.headers?.['CSRF-Prevention-Token']).toBe('csrf-token-value')
  })

  it('returns false when success is false', async () => {
    const http = new FakeHttp(() => json({ success: false }))
    expect(await new HumbleApi(http).chooseContent('gk', 'initial', 'g')).toBe(false)
  })
})

describe('getChoiceMonth', () => {
  const order: ChoiceOrder = {
    gamekey: 'gk',
    name: 'November 2026',
    choiceUrl: 'november-2026',
    created: '2026-11-01',
    choicesRemaining: 2,
    isV3: false,
    chosenMachineNames: new Set()
  }
  const page = (data: unknown): string =>
    `<html><script id="webpack-monthly-product-data" type="application/json">${JSON.stringify(data)}</script></html>`

  it('fetches and parses the month page', async () => {
    const options = {
      canRedeemGames: true,
      usesChoices: true,
      contentChoiceData: {
        initial: {
          content_choices: {
            a: { display_item_machine_name: 'a', title: 'A', tpkds: [{ gamekey: 'gk' }] }
          }
        }
      }
    }
    const http = new FakeHttp(() => ({
      status: 200,
      body: page({ contentChoiceOptions: options })
    }))
    const month = await new HumbleApi(http).getChoiceMonth(order)
    expect(http.calls[0].url).toBe('https://www.humblebundle.com/subscription/november-2026')
    expect(month?.games.map((g) => g.identifier)).toEqual(['a'])
    expect(month?.parentIdentifier).toBe('initial')
  })

  it('throws ServiceChangedError when the page has no data', async () => {
    const http = new FakeHttp(() => ({ status: 200, body: '<html></html>' }))
    await expect(new HumbleApi(http).getChoiceMonth(order)).rejects.toBeInstanceOf(
      ServiceChangedError
    )
  })

  it('throws SessionExpiredError on a redirect', async () => {
    const http = new FakeHttp(() => ({ status: 302, body: '' }))
    await expect(new HumbleApi(http).getChoiceMonth(order)).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })
})
