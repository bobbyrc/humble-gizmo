import { useEffect, useState } from 'react'
import type { LibraryProgress } from '../shared/ipc'
import { gizmo } from './gizmo'

/** Latest { done, total } the main process reported for the current library load, or null. */
export function useLibraryProgress(): LibraryProgress | null {
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  useEffect(() => gizmo.onLibraryProgress((p) => setProgress(p)), [])
  return progress
}

export function loadingLabel(p: LibraryProgress | null): string {
  return p && p.total > 0
    ? `Loading your library… ${p.done} of ${p.total} purchases`
    : 'Loading your library…'
}
