import { contextBridge, ipcRenderer } from 'electron'
import type { GizmoApi } from '../shared/ipc'
import type { RunEvent } from '../shared/types'

const MARKER = 'GIZMO_ERR:'

// Electron prefixes the message ("Error invoking remote method ..."), so find the marker.
function translate(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  const at = msg.indexOf(MARKER)
  if (at >= 0) {
    try {
      const info = JSON.parse(msg.slice(at + MARKER.length)) as {
        name?: string
        service?: string | null
      }
      const err = new Error(info.name ?? 'Error') as Error & { service?: string | null }
      err.name = info.name ?? 'Error'
      err.service = info.service ?? null
      return err
    } catch {
      // fall through
    }
  }
  return new Error('Unexpected error')
}

const call =
  (method: string) =>
  async (...args: unknown[]): Promise<never> => {
    try {
      return (await ipcRenderer.invoke(`gizmo:${method}`, ...args)) as never
    } catch (e) {
      throw translate(e)
    }
  }

const api: GizmoApi = {
  getSettings: call('getSettings'),
  setSettings: call('setSettings'),
  signIn: call('signIn'),
  signOut: call('signOut'),
  status: call('status'),
  loadLibrary: call('loadLibrary'),
  buildReview: call('buildReview'),
  startRun: call('startRun'),
  stopRun: call('stopRun'),
  onRunEvent(cb) {
    const listener = (_e: unknown, event: RunEvent): void => cb(event)
    ipcRenderer.on('gizmo:run-event', listener)
    return () => {
      ipcRenderer.removeListener('gizmo:run-event', listener)
    }
  },
  listChoiceMonths: call('listChoiceMonths'),
  claimChoices: call('claimChoices'),
  openExternal: call('openExternal'),
  history: call('history'),
  exportCsv: call('exportCsv'),
  deleteAllData: call('deleteAllData'),
  checkForUpdatesNow: call('checkForUpdatesNow'),
  storageEncrypted: call('storageEncrypted')
}

contextBridge.exposeInMainWorld('gizmo', api)
