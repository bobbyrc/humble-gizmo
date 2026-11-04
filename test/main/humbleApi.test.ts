import { describe, expect, it } from 'vitest'
import { ChoicePageRedirectError, HumbleApi } from '../../src/main/humble/humbleApi'
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
const BATCH_URL = 'https://www.humblebundle.com/api/v1/orders?'
/** Wraps a handler so the batch endpoint answers 404, which makes getOrders fetch per order. */
const noBatch =
  (handler: (call: Call, n: number) => Res | Promise<Res>) =>
  (call: Call, n: number): Res | Promise<Res> =>
    call.url.startsWith(BATCH_URL) ? { status: 404, body: '' } : handler(call, n)
const batchGamekeys = (url: string): string[] => new URL(url).searchParams.getAll('gamekeys')
const orderCalls = (http: FakeHttp): Call[] => http.calls.filter((c) => c.url.startsWith(ORDER_URL))
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
    const http = new FakeHttp(
      noBatch((call) => {
        if (call.url.includes('/k3?') || call.url.includes('/k11?'))
          return { status: 500, body: '' }
        return json({ gamekey: call.url.split('/').pop()!.split('?')[0] })
      })
    )
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(keys)
    expect(r.orders).toHaveLength(18)
    expect(r.failed.sort()).toEqual(['k11', 'k3'])
  })

  it('retries a transient failure', async () => {
    const http = new FakeHttp(
      noBatch((call, n) => (n === 1 ? { status: 500, body: '' } : json({ ok: call.url })))
    )
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(['a'])
    expect(r.orders).toHaveLength(1)
    expect(r.failed).toEqual([])
  })

  it('backs off 2s times the attempt number', async () => {
    const waits: number[] = []
    const http = new FakeHttp(noBatch(() => ({ status: 500, body: '' })))
    await new HumbleApi(http, { sleep: async (ms) => void waits.push(ms) }).getOrders(['a'])
    expect(waits).toEqual([2000, 4000])
    expect(orderCalls(http)).toHaveLength(3)
  })

  it('requests all_tpkds', async () => {
    const http = new FakeHttp(noBatch(() => json({})))
    await new HumbleApi(http, { sleep: noSleep }).getOrders(['abc'])
    expect(orderCalls(http)[0].url).toBe(`${ORDER_URL}abc?all_tpkds=true`)
  })

  it('never runs more than the concurrency limit at once', async () => {
    let active = 0
    let peak = 0
    const http = new FakeHttp(
      noBatch(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 1))
        active--
        return json({})
      })
    )
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

describe('getOrders batch phase', () => {
  const four = ['a', 'b', 'c', 'd']
  const batchBody = (url: string): Res =>
    json(Object.fromEntries(batchGamekeys(url).map((k) => [k, { gamekey: k }])))

  it('fetches in batches with no per-order calls and keeps the input order', async () => {
    const http = new FakeHttp((call) =>
      call.url.startsWith(BATCH_URL) ? batchBody(call.url) : { status: 500, body: '' }
    )
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(four, { batchSize: 2 })
    expect(r.failed).toEqual([])
    expect(r.orders).toEqual(four.map((k) => ({ gamekey: k })))
    expect(http.calls).toHaveLength(2)
    expect(orderCalls(http)).toHaveLength(0)
  })

  it('sends all_tpkds and one repeated gamekeys param per key', async () => {
    const http = new FakeHttp((call) => batchBody(call.url))
    await new HumbleApi(http, { sleep: noSleep }).getOrders(['a', 'b'], { batchSize: 2 })
    const url = new URL(http.calls[0].url)
    expect(`${url.origin}${url.pathname}`).toBe('https://www.humblebundle.com/api/v1/orders')
    expect(url.searchParams.get('all_tpkds')).toBe('true')
    expect(url.searchParams.getAll('gamekeys')).toEqual(['a', 'b'])
  })

  it('fetches a gamekey that a batch omits, one order at a time', async () => {
    const http = new FakeHttp((call) => {
      if (call.url.startsWith(BATCH_URL)) return json({ a: { gamekey: 'a' } })
      return json({ gamekey: 'b' })
    })
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(['a', 'b'], { batchSize: 2 })
    expect(r.orders).toEqual([{ gamekey: 'a' }, { gamekey: 'b' }])
    expect(orderCalls(http).map((c) => c.url)).toEqual([`${ORDER_URL}b?all_tpkds=true`])
  })

  it('fetches a chunk one order at a time when that batch returns 500', async () => {
    const http = new FakeHttp((call) => {
      if (call.url.startsWith(BATCH_URL)) {
        return batchGamekeys(call.url).includes('a')
          ? { status: 500, body: '' }
          : batchBody(call.url)
      }
      return json({ gamekey: call.url.split('/').pop()!.split('?')[0] })
    })
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(four, { batchSize: 2 })
    expect(r.failed).toEqual([])
    expect(r.orders).toEqual(four.map((k) => ({ gamekey: k })))
    expect(orderCalls(http).map((c) => c.url)).toEqual([
      `${ORDER_URL}a?all_tpkds=true`,
      `${ORDER_URL}b?all_tpkds=true`
    ])
  })

  it('stops batching after a 404 on the first batch and fetches everything else one at a time', async () => {
    const gamekeys = Array.from({ length: 10 }, (_, i) => `k${i}`)
    const http = new FakeHttp((call) => {
      if (call.url.startsWith(BATCH_URL)) return { status: 404, body: '' }
      return json({ gamekey: call.url.split('/').pop()!.split('?')[0] })
    })
    const r = await new HumbleApi(http, { sleep: noSleep }).getOrders(gamekeys, { batchSize: 2 })
    // Five chunks, but only the first four start before any settles, so only four batch requests.
    expect(http.calls.filter((c) => c.url.startsWith(BATCH_URL))).toHaveLength(4)
    expect(orderCalls(http)).toHaveLength(10)
    expect(r.orders).toHaveLength(10)
    expect(r.failed).toEqual([])
  })

  it.each([302, 401])(
    'a batch answering %i ends the whole fetch as an expired session',
    async (status) => {
      const http = new FakeHttp((call) =>
        call.url.startsWith(BATCH_URL) ? { status, body: '' } : json({})
      )
      await expect(
        new HumbleApi(http, { sleep: noSleep }).getOrders(four, { batchSize: 2 })
      ).rejects.toBeInstanceOf(SessionExpiredError)
      expect(orderCalls(http)).toHaveLength(0)
    }
  )

  it('reports progress from 0 to the total', async () => {
    const http = new FakeHttp((call) => batchBody(call.url))
    const progress: [number, number][] = []
    await new HumbleApi(http, { sleep: noSleep }).getOrders(four, {
      batchSize: 2,
      onProgress: (done, total) => progress.push([done, total])
    })
    expect(progress[0]).toEqual([0, 4])
    expect(progress.at(-1)).toEqual([4, 4])
  })

  it('reports progress through the per-order fallback and ends at the total', async () => {
    const http = new FakeHttp(
      noBatch((call) => json({ gamekey: call.url.split('/').pop()!.split('?')[0] }))
    )
    const progress: [number, number][] = []
    await new HumbleApi(http, { sleep: noSleep }).getOrders(four, {
      onProgress: (done, total) => progress.push([done, total])
    })
    expect(progress[0]).toEqual([0, 4])
    expect(progress.at(-1)).toEqual([4, 4])
    // The 404 chunk reports once (still 0 done), then each of the four orders reports once.
    expect(progress.map(([done]) => done)).toEqual([0, 0, 1, 2, 3, 4])
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

  it('throws ChoicePageRedirectError on a redirect, not SessionExpiredError', async () => {
    const http = new FakeHttp(() => ({ status: 302, body: '' }))
    const err = await new HumbleApi(http).getChoiceMonth(order).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ChoicePageRedirectError)
    expect(err).not.toBeInstanceOf(SessionExpiredError)
  })

  it('still throws SessionExpiredError for the login page', async () => {
    const http = new FakeHttp(() => ({
      status: 200,
      body: '<form action="/processlogin"></form>'
    }))
    await expect(new HumbleApi(http).getChoiceMonth(order)).rejects.toBeInstanceOf(
      SessionExpiredError
    )
  })
})
