/** Extracts the SteamID64 from a `steamLoginSecure` cookie value ("<id>%7C%7C<jwt>" or "<id>||<jwt>"). */
export function steamIdFromLoginCookie(value: string): string | null {
  const m = /^(\d+)(?:%7C%7C|\|\|)/i.exec(value)
  return m ? m[1] : null
}
