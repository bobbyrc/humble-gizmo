import type { Session } from 'electron'
import { posix, win32 } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface AllowlistOpts {
  updatesAllowed: boolean
  devServer?: boolean
  // Absolute path of the app's own files. `file:` URLs are allowed only under this root.
  appFileRoot?: string
  // Defaults from process.platform. Overridable so Windows paths can be tested elsewhere.
  platform?: 'win32' | 'posix'
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
// Only reachable when the user has turned on update checks. Exact matches only.
const UPDATE_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
]

function hostIsOrUnder(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function isAppFile(parsed: URL, opts: AllowlistOpts): boolean {
  const appRoot = opts.appFileRoot
  if (!appRoot || parsed.hostname !== '') return false
  const platform = opts.platform ?? (process.platform === 'win32' ? 'win32' : 'posix')
  const looksWindows = /^[a-zA-Z]:[\\/]/.test(appRoot) || appRoot.startsWith('\\\\')
  const p = looksWindows ? win32 : posix
  const fold = (s: string): string => (p === win32 ? s.toLowerCase() : s)
  try {
    const filePath = p.resolve(fileURLToPath(parsed, { windows: platform === 'win32' }))
    const root = fold(p.resolve(appRoot))
    const file = fold(filePath)
    const prefix = root.endsWith(p.sep) ? root : root + p.sep
    return file === root || file.startsWith(prefix)
  } catch {
    return false
  }
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
      return isAppFile(parsed, opts)
    case 'devtools:':
    case 'data:':
      return true
    case 'http:':
    case 'ws:':
      return opts.devServer === true && parsed.hostname === 'localhost'
    case 'https:':
      break
    default:
      return false
  }

  const host = parsed.hostname
  if (SUFFIX_HOSTS.some((domain) => hostIsOrUnder(host, domain))) return true
  if (EXACT_HOSTS.includes(host)) return true
  if (opts.updatesAllowed && UPDATE_HOSTS.includes(host)) return true
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
