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
    const stored = await readJson<Partial<Settings>>(file)
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
