/**
 * Removes personal data and secrets from a captured response so it can be committed as a test
 * fixture. Fakes are stable for one salt (same input, same fake) and unrelated across salts, so
 * the real values cannot be recovered from a fixture once the run's salt is gone.
 * Game titles and app ids are kept on purpose.
 */

const KEY_SHAPE = /[A-Z0-9]{4,6}(?:-[A-Z0-9]{4,6}){2,4}/
const KEY_SHAPE_GLOBAL = new RegExp(KEY_SHAPE.source, 'g')
const STEAMID_GLOBAL = /7656119\d{10}/g
const EMAIL_GLOBAL = /[A-Za-z0-9._%+-]+@(?!example\.com(?![\w.-]))[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const MIXED = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DIGITS = '0123456789'

type Kind = 'gamekey' | 'email' | 'steamid' | 'secret'

/** Deterministic stream of 32-bit values from a string (cyrb128 seeding, mulberry32 output). */
function randoms(seed: string): () => number {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  let a = (h1 ^ h2 ^ h3 ^ h4) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

function chars(salt: string, tag: string, value: string, n: number, alphabet: string): string {
  const next = randoms(`${salt}\u0000${tag}\u0000${value}`)
  let out = ''
  for (let i = 0; i < n; i++) out += alphabet[next() % alphabet.length]
  return out
}

const fakeKey = (salt: string, value: string): string =>
  `FAKE1-${chars(salt, 'key', value, 5, ALNUM)}-${chars(salt, 'key2', value, 5, ALNUM)}`

function fakeFor(kind: Kind, salt: string, value: string): string {
  switch (kind) {
    case 'gamekey':
      return chars(salt, 'gamekey', value, 16, MIXED)
    case 'email':
      return `user-${chars(salt, 'email', value, 8, ALNUM).toLowerCase()}@example.com`
    case 'steamid':
      return '7656119' + chars(salt, 'steamid', value, 10, DIGITS)
    case 'secret':
      return 'FAKE-' + chars(salt, 'secret', value, 20, MIXED)
  }
}

function kindOfProperty(name: string): Kind | null {
  const n = name.toLowerCase()
  if (n === 'gamekey') return 'gamekey'
  if (n === 'email') return 'email'
  if (n === 'steamid') return 'steamid'
  if (n.includes('token') || n.includes('cookie')) return 'secret'
  return null
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isSteamIdNumber = (n: number): boolean =>
  Number.isFinite(n) && n >= 7.656119e16 && n < 7.65612e16

/** First pass: every scalar sitting under a sensitive property name. */
function collect(v: unknown, found: Map<string, Kind>, forced: Kind | null = null): void {
  if (Array.isArray(v)) {
    for (const item of v) collect(item, found, forced)
  } else if (isObj(v)) {
    for (const [k, val] of Object.entries(v)) collect(val, found, kindOfProperty(k) ?? forced)
  } else if (forced !== null) {
    if (typeof v === 'string' && v.length >= 6) found.set(v, forced)
    else if (typeof v === 'number' && Number.isInteger(v) && String(v).length >= 6)
      found.set(String(v), forced)
  }
}

export function sanitize(value: unknown, salt: string): unknown {
  const known = new Map<string, Kind>()
  collect(value, known)
  // Longest first so a value that contains another is replaced whole.
  const knownList = [...known.entries()].sort((a, b) => b[0].length - a[0].length)

  const scrub = (s: string): string => {
    if (KEY_SHAPE.test(s)) return fakeKey(salt, s)
    let out = s
    for (const [orig, kind] of knownList) {
      if (out.includes(orig)) out = out.split(orig).join(fakeFor(kind, salt, orig))
    }
    out = out.replace(STEAMID_GLOBAL, (m) => fakeFor('steamid', salt, m))
    return out.replace(EMAIL_GLOBAL, 'user@example.com')
  }

  const scrubName = (name: string): string =>
    scrub(name.replace(KEY_SHAPE_GLOBAL, (m) => fakeKey(salt, m)))

  const walk = (v: unknown, forced: Kind | null): unknown => {
    if (typeof v === 'string') {
      if (forced !== null) return fakeFor(forced, salt, v)
      return scrub(v)
    }
    if (typeof v === 'number') {
      if (forced !== null && Number.isInteger(v)) {
        return forced === 'steamid' || isSteamIdNumber(v)
          ? fakeFor('steamid', salt, String(v))
          : Number(chars(salt, 'num', String(v), 9, DIGITS))
      }
      return isSteamIdNumber(v) ? fakeFor('steamid', salt, String(v)) : v
    }
    if (Array.isArray(v)) return v.map((item) => walk(item, forced))
    if (isObj(v)) {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) {
        if (k === 'redeemed_key_val') {
          out[k] = val === null || val === undefined ? val : fakeKey(salt, String(val))
          continue
        }
        out[scrubName(k)] = walk(val, kindOfProperty(k) ?? forced)
      }
      return out
    }
    return v
  }

  return walk(value, null)
}

/** True when text still holds a real-looking Steam key or email. Used as a last check before writing. */
export function hasLeaks(text: string): boolean {
  const keys = text.match(KEY_SHAPE_GLOBAL) ?? []
  if (keys.some((k) => !k.startsWith('FAKE1-'))) return true
  return new RegExp(EMAIL_GLOBAL.source).test(text)
}
