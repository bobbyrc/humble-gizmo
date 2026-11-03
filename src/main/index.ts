import { app, BrowserWindow } from 'electron'
import { runProbe } from './dev/probe'
import { createAppWindow } from './windows/appWindow'

if (process.env.GIZMO_PROBE === '1') {
  // Dev spike (npm run probe): no app window, only the sign-in windows.
  void app.whenReady().then(runProbe)
} else {
  app.whenReady().then(() => {
    createAppWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createAppWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
