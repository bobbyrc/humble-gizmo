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
   * Fetches order details with bounded parallelism. `retries` is the number of attempts per
   * order; between attempts it waits 2s times the attempt number. Orders that still fail are
   * returned in `failed`. An expired session aborts everything.
   */
  async getOrders(
    gamekeys: string[],
    opts: { concurrency?: number; retries?: number } = {}
  ): Promise<{ orders: unknown[]; failed: string[] }> {
    const concurrency = Math.max(1, opts.concurrency ?? 15)
    const attempts = Math.max(1, opts.retries ?? 3)
    const results: (unknown | undefined)[] = new Array(gamekeys.length)
    const ok: boolean[] = new Array(gamekeys.length).fill(false)
    let next = 0
    let fatal: unknown = null

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

    const worker = async (): Promise<void> => {
      while (fatal === null && next < gamekeys.length) {
        const i = next++
        try {
          results[i] = await fetchWithRetry(gamekeys[i])
          ok[i] = true
        } catch (e) {
          if (isFatal(e)) fatal = e
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, gamekeys.length) }, worker))
    if (fatal !== null) throw fatal

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
