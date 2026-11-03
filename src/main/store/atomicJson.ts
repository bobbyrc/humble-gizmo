import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Crash-safe write: the data goes to `<path>.tmp`, is fsynced, then renamed over the target.
 * Readers therefore see either the old file or the new one, never a partial file.
 * Callers must serialize writes to the same path (the tmp name is fixed).
 */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`
  await fs.mkdir(path.dirname(file), { recursive: true })
  const handle = await fs.open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(JSON.stringify(data), 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, file)
  await syncDirBestEffort(path.dirname(file))
}

async function syncDirBestEffort(dir: string): Promise<void> {
  try {
    const handle = await fs.open(dir, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Directory fsync is unsupported on some platforms (e.g. Windows); the rename already happened.
  }
}

/** Returns null when the file does not exist. Throws on unreadable or corrupt JSON. */
export async function readJson<T>(file: string): Promise<T | null> {
  let text: string
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  return JSON.parse(text) as T
}
