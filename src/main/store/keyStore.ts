import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { KeyRecord } from '../../shared/types'
import { readJson, writeJsonAtomic } from './atomicJson'
import { plaintextCodec, type SecretCodec } from './codec'

type StoredRecord = Omit<KeyRecord, 'revealedKey'> & { revealedKey: string | null }
type KeysFile = { version: 1; encrypted: boolean; records: Record<string, StoredRecord> }

export class KeyStore {
  private chain: Promise<void> = Promise.resolve()

  private constructor(
    private readonly file: string,
    private readonly codec: SecretCodec,
    private readonly records: Map<string, KeyRecord>
  ) {}

  static async open(dir: string, codec: SecretCodec): Promise<KeyStore> {
    const file = path.join(dir, 'keys.json')
    // A stray keys.json.tmp is a crashed write that never got renamed; it is ignored.
    const stored = await readJson<KeysFile>(file)
    const records = new Map<string, KeyRecord>()
    if (stored) {
      // Decode with whatever the file was written with, not with what the codec would write now.
      if (stored.encrypted && !codec.encrypted) {
        throw new Error('keys.json is encrypted but no encrypting codec is available')
      }
      const reader = stored.encrypted ? codec : plaintextCodec
      for (const [id, r] of Object.entries(stored.records)) {
        records.set(id, {
          ...r,
          revealedKey: r.revealedKey === null ? null : reader.decode(r.revealedKey)
        })
      }
    }
    return new KeyStore(file, codec, records)
  }

  get(id: string): KeyRecord | undefined {
    return this.records.get(id)
  }

  all(): Map<string, KeyRecord> {
    return new Map(this.records)
  }

  /** Updates memory now; resolves once a write containing this change has reached disk. */
  upsert(r: KeyRecord): Promise<void> {
    this.records.set(r.id, r)
    return this.enqueue(() => writeJsonAtomic(this.file, this.snapshot()))
  }

  async deleteAll(): Promise<void> {
    this.records.clear()
    await this.enqueue(async () => {
      await fs.rm(this.file, { force: true })
      await fs.rm(`${this.file}.tmp`, { force: true })
    })
  }

  // The snapshot is taken when the write runs, so queued upserts coalesce into later writes.
  private snapshot(): KeysFile {
    const records: Record<string, StoredRecord> = {}
    for (const [id, r] of this.records) {
      records[id] = {
        ...r,
        revealedKey: r.revealedKey === null ? null : this.codec.encode(r.revealedKey)
      }
    }
    return { version: 1, encrypted: this.codec.encrypted, records }
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const result = this.chain.then(op)
    this.chain = result.catch(() => undefined) // one failed write must not wedge later ones
    return result
  }
}
