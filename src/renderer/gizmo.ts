import type { GizmoApi } from '../shared/ipc'

// Resolved lazily on every access, so the binding follows whatever window.gizmo is at call time.
export const gizmo: GizmoApi = new Proxy({} as GizmoApi, {
  get: (_t, k) => (window.gizmo as unknown as Record<string | symbol, unknown>)[k]
})

/** Error names survive IPC (Task 17a); screens branch on e.g. 'ServiceChangedError'. */
export function errorName(e: unknown): string {
  return (e as Error)?.name ?? 'Error'
}
