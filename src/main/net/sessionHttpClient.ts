import type { Session } from 'electron'
import { encodeForm, requireAllowed, type HttpClient } from './httpClient'

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
    const res = await ses.fetch(url, { ...init, redirect: 'manual' })
    return { status: res.status, body: await res.text() }
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
