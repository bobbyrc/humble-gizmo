import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../../shared/types'
import { readJson, writeJsonAtomic } from './atomicJson'

export class SettingsStore {
  private chain: Promise<void> = Promise.resolve()

  private constructor(
    private readonly file: string,
    private current: Settings
  ) {}

  static async open(dir: string): Promise<SettingsStore> {
    const file = path.join(dir, 'settings.json')
    let stored: Partial<Settings> | null
    try {
      stored = await readJson<Partial<Settings>>(file)
    } catch (e) {
      // Unreadable settings are not worth blocking startup: keep the file aside and start fresh.
      if (!(e instanceof Error) || !e.message.startsWith('corrupt JSON')) throw e
      const aside = `settings.unreadable-${Date.now()}.json`
      await fs.rename(file, path.join(dir, aside))
      console.warn(`settings.json was unreadable; moved to ${aside}`)
      stored = null
    }
    return new SettingsStore(file, { ...DEFAULT_SETTINGS, ...stored })
  }

  get(): Settings {
    return this.current
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    this.current = { ...this.current, ...patch }
    const result = this.chain.then(() => writeJsonAtomic(this.file, this.current))
    this.chain = result.catch(() => undefined)
    await result
    return this.current
  }
}
