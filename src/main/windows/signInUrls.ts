import type { Service } from '../../shared/types'

export const PARTITIONS: Record<Service, string> = {
  humble: 'persist:humble',
  steam: 'persist:steam'
}

export const SIGN_IN_URLS: Record<Service, string> = {
  humble: 'https://www.humblebundle.com/login?goto=/home/library',
  steam: 'https://store.steampowered.com/login/?redir=account%2Fregisterkey'
}

export const STATUS_URLS: Record<Service, string> = {
  humble: 'https://www.humblebundle.com/home/library',
  steam: 'https://store.steampowered.com/account/registerkey'
}

const SERVICE_DOMAINS = ['humblebundle.com', 'steampowered.com', 'steamcommunity.com']

function parseHttps(url: string): URL | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

/** True once the window has reached the service's status page (past the login form). */
export function isSignInSuccessUrl(service: Service, url: string): boolean {
  const parsed = parseHttps(url)
  const status = new URL(STATUS_URLS[service])
  return (
    parsed !== null && parsed.hostname === status.hostname && parsed.pathname === status.pathname
  )
}

/** True for https URLs on Humble or Steam hosts (exact domain or a subdomain). */
export function isSameServiceNavigation(url: string): boolean {
  const parsed = parseHttps(url)
  if (!parsed) return false
  const host = parsed.hostname.toLowerCase()
  return SERVICE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}
