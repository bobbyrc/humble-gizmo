import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'

/** Creates the tray icon, or returns null when the platform cannot show one (best effort on Linux). */
export function createTray(onOpen: () => void, onQuit: () => void): { destroy(): void } | null {
  try {
    let icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources', 'icon.png'))
    if (process.platform === 'darwin' || process.platform === 'win32') {
      icon = icon.resize({ width: 16, height: 16 })
    }
    const tray = new Tray(icon)
    tray.setToolTip('Humble Gizmo')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Humble Gizmo', click: onOpen },
        { label: 'Quit', click: onQuit }
      ])
    )
    tray.on('click', onOpen)
    return { destroy: () => tray.destroy() }
  } catch {
    return null
  }
}
