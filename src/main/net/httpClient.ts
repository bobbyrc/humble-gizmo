import { isAllowedUrl, type AllowlistOpts } from './allowlist'

export interface HttpClient {
  get(url: string): Promise<{ status: number; body: string }>
  postForm(
    url: string,
    form: [string, string][],
    headers?: Record<string, string>
  ): Promise<{ status: number; body: string }>
  getCookie(url: string, name: string): Promise<string | undefined>
}

/** Throws before any request is made when the URL's host is not on the allowlist. */
export function requireAllowed(url: string, opts: AllowlistOpts = { updatesAllowed: false }): void {
  if (isAllowedUrl(url, opts)) return
  let host = '(unparseable)'
  try {
    host = new URL(url).hostname
  } catch {
    // keep the placeholder; never echo the full URL, it can carry tokens
  }
  throw new Error('blocked host: ' + host)
}

/** URL-encodes form pairs, keeping duplicate keys and order. */
export function encodeForm(form: [string, string][]): string {
  return new URLSearchParams(form).toString()
}
