/**
 * Pulls the 17-digit SteamID64 off the front of a steamLoginSecure cookie value
 * ("<steamid>||<jwt>", with the separator possibly URL-encoded as %7C%7C).
 */
export function steamIdFromLoginCookie(value: string): string | null {
  const m = /^(\d{17})(?:%7C%7C|\|\|)/i.exec(value)
  return m ? m[1] : null
}

/** Decodes the HTML entities Steam uses when it embeds JSON in a data-* attribute. */
export function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
