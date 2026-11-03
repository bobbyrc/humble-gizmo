import { describe, expect, it } from 'vitest'
import { requireAllowed } from '../../src/main/net/httpClient'

describe('requireAllowed', () => {
  it('passes for Humble and Steam hosts', () => {
    expect(() => requireAllowed('https://www.humblebundle.com/api/v1/user/order')).not.toThrow()
    expect(() =>
      requireAllowed('https://store.steampowered.com/dynamicstore/userdata/')
    ).not.toThrow()
  })

  it('throws naming the blocked host', () => {
    expect(() => requireAllowed('https://evil.example.com/x?token=1')).toThrow(
      'blocked host: evil.example.com'
    )
  })

  it('blocks update hosts unless updates are allowed', () => {
    expect(() => requireAllowed('https://api.github.com/x')).toThrow('blocked host: api.github.com')
    expect(() => requireAllowed('https://api.github.com/x', { updatesAllowed: true })).not.toThrow()
  })

  it('blocks plain http', () => {
    expect(() => requireAllowed('http://www.humblebundle.com/')).toThrow('blocked host')
  })
})
