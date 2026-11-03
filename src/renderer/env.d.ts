import type { GizmoApi } from '../shared/ipc'

declare global {
  interface Window {
    gizmo: GizmoApi
  }
}

export {}
