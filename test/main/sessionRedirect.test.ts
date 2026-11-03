import { describe, expect, it } from 'vitest'
import { fetchManual } from '../../src/main/net/sessionHttpClient'
import { checkSignedInWith } from '../../src/main/windows/checkSignedInWith'

const rejecting = (msg: string): { fetch: () => Promise<Response> } => ({
  fetch: async (): Promise<Response> => {
    throw new Error(msg)
  }
})

describe('fetchManual', () => {
  it('maps the "Redirect was cancelled" rejection to a 302 with no body', async () => {
    const res = await fetchManual(
      rejecting('net::ERR_FAILED: Redirect was cancelled'),
      'https://x',
      {
        method: 'GET'
      }
    )
    expect(res).toEqual({ status: 302, body: '' })
  })

  it('rethrows other errors', async () => {
    await expect(fetchManual(rejecting('offline'), 'https://x', { method: 'GET' })).rejects.toThrow(
      'offline'
    )
  })

  it('returns status and body for a normal response', async () => {
    const ses = { fetch: async (): Promise<Response> => new Response('hi', { status: 200 }) }
    expect(await fetchManual(ses, 'https://x', { method: 'GET' })).toEqual({
      status: 200,
      body: 'hi'
    })
  })
})

describe('checkSignedInWith', () => {
  it('treats the redirect-cancelled rejection as signed out', async () => {
    expect(await checkSignedInWith(rejecting('Redirect was cancelled'), 'https://x')).toBe(false)
  })

  it('still throws other errors', async () => {
    await expect(checkSignedInWith(rejecting('offline'), 'https://x')).rejects.toThrow('offline')
  })

  it('is signed in on a 200', async () => {
    const ses = { fetch: async (): Promise<Response> => new Response('', { status: 200 }) }
    expect(await checkSignedInWith(ses, 'https://x')).toBe(true)
  })
})
