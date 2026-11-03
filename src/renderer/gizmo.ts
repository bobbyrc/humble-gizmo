import type { GizmoApi } from '../shared/ipc'

export const gizmo: GizmoApi = window.gizmo

/** Error names survive IPC (Task 17a); screens branch on e.g. 'ServiceChangedError'. */
export function errorName(e: unknown): string {
  return (e as Error)?.name ?? 'Error'
}
