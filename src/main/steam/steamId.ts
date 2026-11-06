/** Extracts the SteamID64 from a `steamLoginSecure` cookie value ("<id>%7C%7C<jwt>" or "<id>||<jwt>"). */
export function steamIdFromLoginCookie(value: string): string | null {
  const m = /^(\d+)(?:%7C%7C|\|\|)/i.exec(value)
  return m ? m[1] : null
}

/**
 * True when the cookie's access token (a JWT, valid about a day) has expired or will within a
 * minute. An unreadable token counts as unexpired, so a Steam format change cannot lock anyone out.
 */
export function loginTokenExpired(value: string, nowMs = Date.now()): boolean {
  try {
    const jwt = decodeURIComponent(value).split('||')[1] ?? ''
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString()) as {
      exp?: unknown
    }
    return typeof payload.exp === 'number' && payload.exp * 1000 <= nowMs + 60_000
  } catch {
    return false
  }
}
