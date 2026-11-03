import { describe, expect, it } from 'vitest'
import { decodeHtmlAttribute, steamIdFromLoginCookie } from '../../src/main/dev/probeHelpers'

describe('steamIdFromLoginCookie', () => {
  it('reads the id before an encoded separator', () => {
    expect(steamIdFromLoginCookie('76561198000000000%7C%7Cabc.def')).toBe('76561198000000000')
  })
  it('reads the id before a plain separator', () => {
    expect(steamIdFromLoginCookie('76561198000000000||abc')).toBe('76561198000000000')
  })
  it('returns null for anything else', () => {
    expect(steamIdFromLoginCookie('')).toBeNull()
    expect(steamIdFromLoginCookie('abc||def')).toBeNull()
  })
})

describe('decodeHtmlAttribute', () => {
  it('decodes quotes and ampersands', () => {
    expect(decodeHtmlAttribute('{&quot;a&quot;:&quot;x &amp; y&quot;}')).toBe('{"a":"x & y"}')
  })
})
