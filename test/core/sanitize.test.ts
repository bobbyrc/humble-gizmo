import { describe, expect, it } from 'vitest'
import { hasLeaks, sanitize } from '../../src/core/sanitize'

const S = 'salt-1'
const out = (v: unknown, salt = S): unknown => sanitize(v, salt)
const json = (v: unknown): string => JSON.stringify(v)

describe('sanitize', () => {
  it('replaces a whole-string Steam key with a stable FAKE1 key', () => {
    const a = out('AB12C-DE34F-GH56J') as string
    expect(a).toMatch(/^FAKE1-[A-Z0-9]{5}-[A-Z0-9]{5}$/)
    expect(out('AB12C-DE34F-GH56J')).toBe(a)
    expect(out('ZZZZZ-DE34F-GH56J')).not.toBe(a)
  })

  it('replaces a string that merely contains a key-shaped substring', () => {
    const a = out('Your key is AB12C-DE34F-GH56J, enjoy') as string
    expect(a).toMatch(/^FAKE1-/)
    expect(a).not.toContain('AB12C')
  })

  it('drops redeemed_key_val values entirely', () => {
    const a = out({ redeemed_key_val: 'whatever it is' }) as { redeemed_key_val: string }
    expect(a.redeemed_key_val).toMatch(/^FAKE1-[A-Z0-9]{5}-[A-Z0-9]{5}$/)
    expect(json(a)).not.toContain('whatever')
  })

  it('replaces gamekey, email, steamid, token and cookie property values', () => {
    const input = {
      gamekey: 'AbCdEfGhIj123456',
      email: 'bob@gmail.com',
      steamid: 'abc',
      csrf_token: 'tok-secret-value',
      SessionCookie: 'cookie-secret-value',
      nested: [{ gamekey: 'AbCdEfGhIj123456' }]
    }
    const a = out(input) as typeof input
    expect(a.gamekey).not.toBe(input.gamekey)
    expect(a.nested[0].gamekey).toBe(a.gamekey)
    expect(a.email).toMatch(/@example\.com$/)
    expect(a.steamid).not.toBe('abc')
    expect(json(a)).not.toMatch(/tok-secret|cookie-secret|gmail|AbCdEfGhIj/)
    expect(out(input)).toEqual(a)
  })

  it('replaces a known gamekey wherever it appears inside other strings and object keys', () => {
    const a = out({
      gamekey: 'AbCdEfGhIj123456',
      url: '/dl?key=AbCdEfGhIj123456&x=1',
      byKey: { AbCdEfGhIj123456: 1 }
    })
    expect(json(a)).not.toContain('AbCdEfGhIj123456')
  })

  it('replaces 17-digit steam ids in strings and numbers', () => {
    const a = out({ s: 'id 76561198012345678 x', n: JSON.parse('76561198012345678') })
    expect(json(a)).not.toContain('76561198012345678')
    const b = out('76561198012345678') as string
    expect(b).toMatch(/^7656119\d{10}$/)
    expect(b).not.toBe('76561198012345678')
  })

  it('replaces email-shaped strings with user@example.com', () => {
    expect(out('mail me: a.b+c@foo.org please')).toBe('mail me: user@example.com please')
  })

  it('keeps titles and app ids, and does not mutate the input', () => {
    const input = { title: 'Portal 2', appid: 620, list: [1, 2, 3], ok: true, none: null }
    const copy = structuredClone(input)
    expect(out(input)).toEqual(input)
    expect(input).toEqual(copy)
  })

  it('hasLeaks flags real keys and emails but not sanitized output', () => {
    expect(hasLeaks('x AB12C-DE34F-GH56J y')).toBe(true)
    expect(hasLeaks('bob@gmail.com')).toBe(true)
    expect(hasLeaks(JSON.stringify(out({ a: 'AB12C-DE34F-GH56J', b: 'bob@gmail.com' })))).toBe(
      false
    )
  })

  it('gives different fakes under a different salt', () => {
    expect(out('AB12C-DE34F-GH56J', 'a')).not.toBe(out('AB12C-DE34F-GH56J', 'b'))
  })
})
