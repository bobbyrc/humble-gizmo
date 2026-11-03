import { isRedirectCancelled } from '../net/sessionHttpClient'

/** Electron 44 rejects with "Redirect was cancelled" on a redirect, which also means signed out. */
export async function checkSignedInWith(
  ses: { fetch(url: string, init: { redirect: 'manual' }): Promise<Response> },
  url: string
): Promise<boolean> {
  try {
    const res = await ses.fetch(url, { redirect: 'manual' })
    return !(res.status === 301 || res.status === 302 || res.type === 'opaqueredirect')
  } catch (e) {
    if (isRedirectCancelled(e)) return false
    throw e
  }
}
