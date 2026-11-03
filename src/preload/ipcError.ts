const MARKER = 'GIZMO_ERR:'

/**
 * Electron's contextBridge keeps only an Error's message, so the failure is carried in the
 * message as `GIZMO_ERR:{"name":..,"service":..}`. Electron prefixes the message
 * ("Error invoking remote method ..."), so find the marker first.
 */
export function toBridgeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  const at = msg.indexOf(MARKER)
  let name = 'Error'
  let service: string | null = null
  if (at >= 0) {
    try {
      const info = JSON.parse(msg.slice(at + MARKER.length)) as {
        name?: unknown
        service?: unknown
      }
      if (typeof info.name === 'string') name = info.name
      if (typeof info.service === 'string') service = info.service
    } catch {
      // unparseable: fall through to the generic error
    }
  }
  return new Error(MARKER + JSON.stringify({ name, service }))
}
