import type { Session } from 'electron'
import { encodeForm, requireAllowed, type HttpClient } from './httpClient'

/** Minimal slice of Session.fetch, so the redirect handling is testable without Electron. */
export type FetchingSession = {
  fetch(url: string, init: Record<string, unknown>): Promise<Response>
}

/**
 * Electron 44 rejects ("Redirect was cancelled") instead of returning a 3xx when
 * redirect is 'manual'. Both that and an opaque redirect mean a 302 with no body.
 */
export async function fetchManual(
  ses: FetchingSession,
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<{ status: number; body: string }> {
  let res: Response
  try {
    res = await ses.fetch(url, { ...init, redirect: 'manual', credentials: 'include' })
  } catch (e) {
    if (isRedirectCancelled(e)) return { status: 302, body: '' }
    throw e
  }
  const opaque = res.type === 'opaqueredirect' || res.status === 0
  return { status: opaque ? 302 : res.status, body: opaque ? '' : await res.text() }
}

export function isRedirectCancelled(e: unknown): boolean {
  return e instanceof Error && /redirect was cancelled/i.test(e.message)
}

/** Sends requests through the app's signed-in Electron session (cookies included). */
export class SessionHttpClient implements HttpClient {
  constructor(private readonly partition: string) {}

  private async session(): Promise<Session> {
    const { session } = await import('electron')
    return session.fromPartition(this.partition)
  }

  private async send(
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: string }
  ): Promise<{ status: number; body: string }> {
    requireAllowed(url)
    const ses = await this.session()
    return fetchManual(ses, url, init)
  }

  get(url: string): Promise<{ status: number; body: string }> {
    return this.send(url, { method: 'GET' })
  }

  postForm(
    url: string,
    form: [string, string][],
    headers?: Record<string, string>
  ): Promise<{ status: number; body: string }> {
    return this.send(url, { method: 'POST', headers, body: encodeForm(form) })
  }

  async getCookie(url: string, name: string): Promise<string | undefined> {
    requireAllowed(url)
    const ses = await this.session()
    const cookies = await ses.cookies.get({ url, name })
    return cookies[0]?.value
  }
}
