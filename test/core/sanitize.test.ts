import { describe, expect, it } from 'vitest'
import { hasLeaks, sanitize, sanitizeWithOriginals } from '../../src/core/sanitize'

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
    const num: number = JSON.parse('76561198012345678')
    const a = out({ s: 'id 76561198012345678 x', n: num }) as { s: string; n: unknown }
    expect(json(a)).not.toContain('76561198012345678')
    expect(a.n).not.toBe(num)
    expect(String(a.n)).toMatch(/^7656119/)
    expect(a.s).not.toContain('76561198012345678')
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
    expect(hasLeaks('x AB12C-DE34F-GH56J y', new Set())).toBe(true)
    expect(hasLeaks('bob@gmail.com', new Set())).toBe(true)
    const r = sanitizeWithOriginals({ a: 'AB12C-DE34F-GH56J', b: 'bob@gmail.com' }, S)
    expect(hasLeaks(json(r.value), r.originals)).toBe(false)
  })

  it('hasLeaks flags an original value (length >= 4) left in the text', () => {
    expect(hasLeaks('has Zq9xKpLm in it', new Set(['Zq9xKpLm']))).toBe(true)
    expect(hasLeaks('has abc in it', new Set(['abc']))).toBe(false)
    expect(hasLeaks('clean', new Set(['Zq9xKpLm']))).toBe(false)
  })

  it('hasLeaks flags IPv4 addresses', () => {
    expect(hasLeaks('{"ip":"203.0.113.7"}', new Set())).toBe(true)
  })

  it('hasLeaks flags a steam id that is not a generated fake, and accepts fakes', () => {
    expect(hasLeaks('76561198012345678', new Set())).toBe(true)
    const fake = out('76561198012345678') as string
    expect(hasLeaks(fake, new Set())).toBe(false)
  })

  it('sanitizeWithOriginals reports every replaced value, including steam ids', () => {
    const r = sanitizeWithOriginals(
      { steam_id: '76561198012345678', note: 'AB12C-DE34F-GH56J', gamekey: 'AbCdEfGhIj123456' },
      S
    )
    for (const o of ['76561198012345678', 'AB12C-DE34F-GH56J', 'AbCdEfGhIj123456'])
      expect(r.originals.has(o)).toBe(true)
  })

  it('replaces identity-like properties anywhere and leaves no original behind', () => {
    const input = {
      tpkd_dict: {
        all_tpks: [
          {
            gamekey: 'AbCdEfGhIj123456',
            gift_gamekey: 'ZyXwVuTsRq654321',
            redeemed_key_val: 'plain-redeemed-code-77',
            human_name: 'Portal 2',
            download_url: 'https://x.test/dl?gamekey=AbCdEfGhIj123456&z=1',
            note: 'copy of plain-redeemed-code-77 here'
          }
        ]
      },
      uid: 'uid-secret-1234',
      user_id: 'userid-secret-5678',
      steam_id: '76561198012345678',
      personaname: 'SecretPersona',
      billing_address: { street: '12 Privet Drive', city: 'Little Whinging' },
      last4: '4242',
      ip_address: 'hostname-ish',
      card_brand: 'visa-brand-x',
      paypal_email_x: 'pp-secret-val',
      session_id: 'sess-secret-9999',
      csrf_value: 'csrf-secret-8888',
      password: 'hunter2-hunter2',
      account_name: 'acct-secret-name',
      display_name: 'Display Secret'
    }
    const r = sanitizeWithOriginals(input, S)
    const text = json(r.value)
    for (const o of [
      'AbCdEfGhIj123456',
      'ZyXwVuTsRq654321',
      'plain-redeemed-code-77',
      'uid-secret-1234',
      'userid-secret-5678',
      '76561198012345678',
      'SecretPersona',
      '12 Privet Drive',
      'Little Whinging',
      '4242',
      'hostname-ish',
      'visa-brand-x',
      'pp-secret-val',
      'sess-secret-9999',
      'csrf-secret-8888',
      'hunter2-hunter2',
      'acct-secret-name',
      'Display Secret'
    ])
      expect(text, o).not.toContain(o)
    expect(text).toContain('Portal 2')
    expect(hasLeaks(text, r.originals)).toBe(false)
  })

  it('only replaces integers of 6+ digits under token and cookie properties', () => {
    const a = out({ csrf_token: 12, cookie_count_token: 123456789 }) as Record<string, unknown>
    expect(a.csrf_token).toBe(12)
    expect(a.cookie_count_token).not.toBe(123456789)
  })

  it('gives an object key that is a Steam key the same fake as the value form', () => {
    const a = out({ 'AB12C-DE34F-GH56J': 1, v: 'AB12C-DE34F-GH56J' }) as Record<string, unknown>
    expect(Object.keys(a)).toContain(a.v as string)
  })

  it('gives different fakes under a different salt', () => {
    expect(out('AB12C-DE34F-GH56J', 'a')).not.toBe(out('AB12C-DE34F-GH56J', 'b'))
  })
})
