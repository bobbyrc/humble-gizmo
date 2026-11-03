import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyLinuxAutostart, linuxExecPath } from '../../src/main/autostart'

let home: string
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-autostart-'))
})
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true })
})
const file = (): string => path.join(home, '.config', 'autostart', 'humble-gizmo.desktop')

describe('applyLinuxAutostart', () => {
  it('writes a desktop entry with a quoted Exec', async () => {
    await applyLinuxAutostart(true, home, '/opt/Humble Gizmo/humble-gizmo')
    const text = await fs.readFile(file(), 'utf8')
    expect(text).toContain('[Desktop Entry]')
    expect(text).toContain('Exec="/opt/Humble Gizmo/humble-gizmo"')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
  })

  it('removes the entry when disabled, and tolerates a missing file', async () => {
    await applyLinuxAutostart(true, home, '/x/gizmo')
    await applyLinuxAutostart(false, home, '/x/gizmo')
    await expect(fs.stat(file())).rejects.toThrow()
    await expect(applyLinuxAutostart(false, home, '/x/gizmo')).resolves.toBeUndefined()
  })
})

describe('linuxExecPath', () => {
  it('prefers the AppImage path over the temporary mount binary', () => {
    expect(
      linuxExecPath({ APPIMAGE: '/home/u/Gizmo.AppImage' }, '/tmp/.mount_x/humble-gizmo')
    ).toBe('/home/u/Gizmo.AppImage')
    expect(linuxExecPath({}, '/opt/gizmo/humble-gizmo')).toBe('/opt/gizmo/humble-gizmo')
  })
})
