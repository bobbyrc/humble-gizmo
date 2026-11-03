import type { GizmoApi } from '../shared/ipc'

// Resolved lazily on every access, so the binding follows whatever window.gizmo is at call time.
export const gizmo: GizmoApi = new Proxy({} as GizmoApi, {
  get: (_t, k) => (window.gizmo as unknown as Record<string | symbol, unknown>)[k]
})

const MARKER = 'GIZMO_ERR:'

type Wire = { name?: unknown; service?: unknown }

// Electron's contextBridge keeps only `message`, so the preload encodes name and service into it.
function parseWire(e: unknown): Wire | null {
  const message = (e as Error | null)?.message
  if (typeof message !== 'string' || !message.startsWith(MARKER)) return null
  try {
    const parsed: unknown = JSON.parse(message.slice(MARKER.length))
    return parsed !== null && typeof parsed === 'object' ? (parsed as Wire) : null
  } catch {
    return null
  }
}

/** Error name as sent by main (via the GIZMO_ERR: message), else the error's own name. */
export function errorName(e: unknown): string {
  const wire = parseWire(e)
  if (wire && typeof wire.name === 'string') return wire.name
  return (e as Error)?.name ?? 'Error'
}

/** Which service an error came from, when main said so. */
export function errorService(e: unknown): 'humble' | 'steam' | null {
  const service = parseWire(e)?.service
  return service === 'humble' || service === 'steam' ? service : null
}
