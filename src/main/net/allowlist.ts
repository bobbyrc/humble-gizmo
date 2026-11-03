import type { Session } from 'electron'

export interface AllowlistOpts {
  updatesAllowed: boolean
  devServer?: boolean
}

// A host is allowed when it equals one of these or is a subdomain of one (dot boundary).
const SUFFIX_HOSTS = [
  'humblebundle.com',
  'steampowered.com',
  'steamcommunity.com',
  'steamstatic.com'
]
// Hosts that must match exactly, with no subdomains.
const EXACT_HOSTS = ['hb.imgix.net']
// Only reachable when the user has turned on update checks.
const UPDATE_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
]

function hostIsOrUnder(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function isAllowedUrl(url: string, opts: AllowlistOpts): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  switch (parsed.protocol) {
    case 'file:':
    case 'devtools:':
    case 'data:':
      return true
    case 'http:':
      return opts.devServer === true && parsed.hostname === 'localhost'
    case 'https:':
      break
    default:
      return false
  }

  const host = parsed.hostname
  if (SUFFIX_HOSTS.some((domain) => hostIsOrUnder(host, domain))) return true
  if (EXACT_HOSTS.includes(host)) return true
  if (opts.updatesAllowed && UPDATE_HOSTS.some((domain) => hostIsOrUnder(host, domain))) return true
  return false
}

// Logs only the host, never the path or query, which can carry tokens or ids.
function hostForLog(url: string): string {
  try {
    return new URL(url).hostname || '(no host)'
  } catch {
    return '(unparseable)'
  }
}

export function installAppSessionGuard(ses: Session, getOpts: () => AllowlistOpts): void {
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url, getOpts())
    if (!allowed) console.warn(`[network] blocked request to ${hostForLog(details.url)}`)
    callback({ cancel: !allowed })
  })
}
