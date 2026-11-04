import { z } from 'zod'
import { buildChoiceMonth, parseMonthPage, type ChoiceOrder } from '../../core/choice'
import { ServiceChangedError, SessionExpiredError } from '../../shared/errors'
import type { ChoiceMonth, HumbleKey } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'

const ORIGIN = 'https://www.humblebundle.com'
const POST_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json, text/javascript, */*; q=0.01'
}

const orderListSchema = z.array(z.object({ gamekey: z.string() }).passthrough())
const orderSchema = z.object({}).passthrough()
const redeemSchema = z
  .object({
    success: z.boolean(),
    key: z.string().optional(),
    error_msg: z.string().optional()
  })
  .passthrough()
const chooseSchema = z.object({ success: z.boolean() }).passthrough()

type Res = { status: number; body: string }

export interface HumbleApiOptions {
  /** Injectable so tests do not wait. */
  sleep?: (ms: number) => Promise<void>
}

/** The choice page redirected: Humble will not open this month, but the session may be fine. */
export class ChoicePageRedirectError extends Error {
  constructor() {
    super('choice page redirected')
    this.name = 'ChoicePageRedirectError'
  }
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function isLoginPage(body: string): boolean {
  return body.includes('<form') && body.includes('/processlogin')
}

/** Throws SessionExpiredError for redirects, 401/403 and the login page. */
function checkSession(res: Res): void {
  if (
    res.status === 0 ||
    (res.status >= 300 && res.status < 400) ||
    res.status === 401 ||
    res.status === 403
  ) {
    throw new SessionExpiredError('humble')
  }
  if (isLoginPage(res.body)) throw new SessionExpiredError('humble')
}

function checkOk(res: Res, endpoint: string): void {
  checkSession(res)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`humble ${endpoint} returned HTTP ${res.status}`)
  }
}

/** Errors that retrying cannot fix: expired session, or a host the allowlist blocks. */
function isFatal(e: unknown): boolean {
  return (
    e instanceof SessionExpiredError || (e instanceof Error && e.message.startsWith('blocked host'))
  )
}

function parseJson<T>(body: string, schema: z.ZodType<T>, endpoint: string): T {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new ServiceChangedError('humble', endpoint)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new ServiceChangedError('humble', endpoint)
  return parsed.data
}

const BATCH_CONCURRENCY = 4

/**
 * Runs task(0..count-1) with at most `limit` in flight. The first error stops new tasks and is
 * rethrown once the tasks already running have settled.
 */
async function runPool(
  count: number,
  limit: number,
  task: (i: number) => Promise<void>
): Promise<void> {
  let next = 0
  // Assigned inside the workers, so TypeScript cannot follow it; the cast keeps it from narrowing to never.
  let failure = null as { error: unknown } | null
  const worker = async (): Promise<void> => {
    while (failure === null && next < count) {
      try {
        await task(next++)
      } catch (error) {
        failure ??= { error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker))
  if (failure !== null) throw failure.error
}

export class HumbleApi {
  private readonly sleep: (ms: number) => Promise<void>

  constructor(
    private readonly http: HttpClient,
    opts: HumbleApiOptions = {}
  ) {
    this.sleep = opts.sleep ?? realSleep
  }

  async listOrderGamekeys(): Promise<string[]> {
    const res = await this.http.get(`${ORIGIN}/api/v1/user/order`)
    checkOk(res, 'order list')
    return parseJson(res.body, orderListSchema, 'order list').map((o) => o.gamekey)
  }

  private async getOrder(gamekey: string): Promise<unknown> {
    const res = await this.http.get(
      `${ORIGIN}/api/v1/order/${encodeURIComponent(gamekey)}?all_tpkds=true`
    )
    checkOk(res, 'order')
    return parseJson(res.body, orderSchema, 'order')
  }

  /**
   * One request for many orders. Returns the body object, 'not-found' on HTTP 404, or null when
   * the chunk failed for any other reason. Session and blocked-host errors still throw.
   */
  private async fetchBatch(
    gamekeys: string[]
  ): Promise<Record<string, unknown> | 'not-found' | null> {
    const params = new URLSearchParams({ all_tpkds: 'true' })
    for (const k of gamekeys) params.append('gamekeys', k)
    let res: Res
    try {
      res = await this.http.get(`${ORIGIN}/api/v1/orders?${params}`)
    } catch (e) {
      if (isFatal(e)) throw e
      return null
    }
    checkSession(res)
    if (res.status === 404) return 'not-found'
    if (res.status < 200 || res.status >= 300) return null
    let body: unknown
    try {
      body = JSON.parse(res.body)
    } catch {
      return null
    }
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  }

  /**
   * Fetches order details. Phase 1 asks for batches of `batchSize` orders (up to 4 batch
   * requests in flight, no retries). Phase 2 fetches, one at a time, every order phase 1 did not
   * return cleanly, plus all remaining orders if the batch endpoint is missing (a 404 on the
   * first batch to finish). Phase 2 uses bounded parallelism (`concurrency`); `retries` is the
   * number of attempts per order, and between attempts it waits 2s times the attempt number.
   * Orders that still fail are returned in `failed`. An expired session aborts everything.
   * `onProgress(done, total)` is called with 0 first, then as batches and single orders settle.
   */
  async getOrders(
    gamekeys: string[],
    opts: {
      concurrency?: number
      retries?: number
      batchSize?: number
      onProgress?: (done: number, total: number) => void
    } = {}
  ): Promise<{ orders: unknown[]; failed: string[] }> {
    const concurrency = Math.max(1, opts.concurrency ?? 15)
    const attempts = Math.max(1, opts.retries ?? 3)
    const batchSize = Math.max(1, opts.batchSize ?? 40)
    const total = gamekeys.length
    const results: unknown[] = new Array(total)
    const ok: boolean[] = new Array(total).fill(false)
    let done = 0
    opts.onProgress?.(0, total)

    const chunks: number[][] = []
    for (let start = 0; start < total; start += batchSize) {
      chunks.push(Array.from({ length: Math.min(batchSize, total - start) }, (_, j) => start + j))
    }
    let batchSupported = true
    let chunkSettled = false
    await runPool(chunks.length, BATCH_CONCURRENCY, async (c) => {
      if (!batchSupported) return
      const indices = chunks[c]
      const body = await this.fetchBatch(indices.map((i) => gamekeys[i]))
      const first = !chunkSettled
      chunkSettled = true
      if (body === 'not-found' && first) batchSupported = false
      if (body !== null && body !== 'not-found') {
        for (const i of indices) {
          const parsed = orderSchema.safeParse(body[gamekeys[i]])
          if (!parsed.success) continue
          results[i] = parsed.data
          ok[i] = true
          done++
        }
      }
      opts.onProgress?.(done, total)
    })

    const fetchWithRetry = async (gamekey: string): Promise<unknown> => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await this.getOrder(gamekey)
        } catch (e) {
          if (isFatal(e) || attempt >= attempts) throw e
          await this.sleep(2000 * attempt)
        }
      }
    }

    const missing = gamekeys.flatMap((_, i) => (ok[i] ? [] : [i]))
    await runPool(missing.length, concurrency, async (m) => {
      const i = missing[m]
      try {
        results[i] = await fetchWithRetry(gamekeys[i])
        ok[i] = true
      } catch (e) {
        if (isFatal(e)) throw e
      }
      done++
      opts.onProgress?.(done, total)
    })

    const orders: unknown[] = []
    const failed: string[] = []
    gamekeys.forEach((k, i) => (ok[i] ? orders.push(results[i]) : failed.push(k)))
    return { orders, failed }
  }

  private async postHeaders(): Promise<Record<string, string>> {
    const csrf = await this.http.getCookie(ORIGIN, 'csrf_cookie')
    if (!csrf) throw new SessionExpiredError('humble')
    return { ...POST_HEADERS, 'CSRF-Prevention-Token': csrf }
  }

  /** Reveals a key on Humble. Returns null when Humble says it could not. */
  async revealKey(k: HumbleKey): Promise<string | null> {
    const headers = await this.postHeaders()
    const res = await this.http.postForm(
      `${ORIGIN}/humbler/redeemkey`,
      [
        ['keytype', k.machineName],
        ['key', k.gamekey],
        ['keyindex', String(k.keyindex)]
      ],
      headers
    )
    checkOk(res, 'redeemkey')
    const body = parseJson(res.body, redeemSchema, 'redeemkey')
    if (!body.success) return null
    if (!body.key) throw new ServiceChangedError('humble', 'redeemkey')
    return body.key
  }

  async getChoiceMonth(order: ChoiceOrder): Promise<ChoiceMonth | null> {
    const res = await this.http.get(`${ORIGIN}/subscription/${encodeURIComponent(order.choiceUrl)}`)
    if (res.status >= 300 && res.status < 400) throw new ChoicePageRedirectError()
    checkOk(res, 'choice page')
    return buildChoiceMonth(order, parseMonthPage(res.body))
  }

  async chooseContent(
    gamekey: string,
    parentIdentifier: string,
    identifier: string
  ): Promise<boolean> {
    const headers = await this.postHeaders()
    const res = await this.http.postForm(
      `${ORIGIN}/humbler/choosecontent`,
      [
        ['gamekey', gamekey],
        ['parent_identifier', parentIdentifier],
        ['chosen_identifiers[]', identifier],
        ['is_multikey_and_from_choice_modal', 'false']
      ],
      headers
    )
    checkOk(res, 'choosecontent')
    return parseJson(res.body, chooseSchema, 'choosecontent').success
  }
}
