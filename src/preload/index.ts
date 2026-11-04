import { contextBridge, ipcRenderer } from 'electron'
import type { GizmoApi, LibraryProgress } from '../shared/ipc'
import type { RunEvent } from '../shared/types'
import { toBridgeError } from './ipcError'

const call =
  (method: string) =>
  async (...args: unknown[]): Promise<never> => {
    try {
      return (await ipcRenderer.invoke(`gizmo:${method}`, ...args)) as never
    } catch (e) {
      throw toBridgeError(e)
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
  onLibraryProgress(cb) {
    const listener = (_e: unknown, progress: LibraryProgress): void => cb(progress)
    ipcRenderer.on('gizmo:library-progress', listener)
    return () => {
      ipcRenderer.removeListener('gizmo:library-progress', listener)
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
