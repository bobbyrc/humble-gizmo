import { vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import type { GizmoApi } from '../../src/shared/ipc'

export type MockGizmo = { [K in keyof GizmoApi]: ReturnType<typeof vi.fn> & GizmoApi[K] }

/** Installs a full GizmoApi of vi.fn()s on window.gizmo. Override any method per test. */
export function mockGizmo(overrides: Partial<GizmoApi> = {}): MockGizmo {
  const api = {
    getSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS, consentShown: true })),
    setSettings: vi.fn(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch })),
    signIn: vi.fn(async () => true),
    signOut: vi.fn(async () => undefined),
    status: vi.fn(async () => ({ humble: true, steam: true })),
    loadLibrary: vi.fn(async () => ({ keys: 0, steamKeys: 0, failedOrders: 0 })),
    buildReview: vi.fn(async () => []),
    startRun: vi.fn(async () => undefined),
    stopRun: vi.fn(async () => undefined),
    onRunEvent: vi.fn(() => () => undefined),
    listChoiceMonths: vi.fn(async () => ({ months: [], locked: 0 })),
    claimChoices: vi.fn(async () => ({ failed: [] })),
    openExternal: vi.fn(async () => undefined),
    history: vi.fn(async () => []),
    exportCsv: vi.fn(async () => ({ saved: false })),
    deleteAllData: vi.fn(async () => undefined),
    checkForUpdatesNow: vi.fn(async () => 'none' as const),
    storageEncrypted: vi.fn(async () => true),
    ...overrides
  } as unknown as MockGizmo
  ;(window as unknown as { gizmo: GizmoApi }).gizmo = api
  return api
}

/** An error as the contextBridge delivers it: a plain Error whose message carries name and service. */
export function bridgeError(name: string, service: 'humble' | 'steam' | null = null): Error {
  return new Error('GIZMO_ERR:' + JSON.stringify({ name, service }))
}
