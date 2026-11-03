import { promises as fs } from 'node:fs'
import { join } from 'node:path'

/** Write or remove the XDG autostart entry (Linux only; macOS/Windows use app.setLoginItemSettings). */
export async function applyLinuxAutostart(
  enabled: boolean,
  home: string,
  execPath: string
): Promise<void> {
  const dir = join(home, '.config', 'autostart')
  const file = join(dir, 'humble-gizmo.desktop')
  if (!enabled) {
    await fs.rm(file, { force: true })
    return
  }
  const quoted = `"${execPath.replace(/(["`$\\])/g, '\\$1')}"`
  const text = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Humble Gizmo',
    `Exec=${quoted}`,
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(file, text, 'utf8')
}
