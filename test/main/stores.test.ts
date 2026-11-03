import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KeyStore } from '../../src/main/store/keyStore'
import { SettingsStore } from '../../src/main/store/settingsStore'
import { plaintextCodec, type SecretCodec } from '../../src/main/store/codec'
import { DEFAULT_SETTINGS, type KeyRecord } from '../../src/shared/types'

const reverseCodec: SecretCodec = {
  encrypted: true,
  encode: (s) => [...s].reverse().join(''),
  decode: (s) => [...s].reverse().join('')
}

const rec = (id: string, revealedKey: string | null = 'AAAAA-BBBBB-CCCCC'): KeyRecord => ({
  id,
  name: `Game ${id}`,
  steamAppId: 42,
  revealedKey,
  outcome: 'redeemed',
  resultCode: 1,
  runId: 'run-1',
  updatedAt: '2026-11-02T00:00:00.000Z'
})

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-stores-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('KeyStore', () => {
  it('returns an equal record after reopening', async () => {
    const s = await KeyStore.open(dir, plaintextCodec)
    await s.upsert(rec('a'))
    const again = await KeyStore.open(dir, plaintextCodec)
    expect(again.get('a')).toEqual(rec('a'))
    expect(again.all().size).toBe(1)
  })

  it('does not store the plaintext key when the codec encrypts', async () => {
    const s = await KeyStore.open(dir, reverseCodec)
    await s.upsert(rec('a'))
    const raw = await fs.readFile(path.join(dir, 'keys.json'), 'utf8')
    expect(raw).not.toContain('AAAAA-BBBBB-CCCCC')
    expect(JSON.parse(raw).encrypted).toBe(true)
    const again = await KeyStore.open(dir, reverseCodec)
    expect(again.get('a')?.revealedKey).toBe('AAAAA-BBBBB-CCCCC')
  })

  it('keeps null revealedKey as null', async () => {
    const s = await KeyStore.open(dir, reverseCodec)
    await s.upsert(rec('n', null))
    const again = await KeyStore.open(dir, reverseCodec)
    expect(again.get('n')?.revealedKey).toBeNull()
  })

  it('persists 50 concurrent upserts', async () => {
    const s = await KeyStore.open(dir, plaintextCodec)
    await Promise.all(Array.from({ length: 50 }, (_, i) => s.upsert(rec(`k${i}`))))
    const again = await KeyStore.open(dir, plaintextCodec)
    expect(again.all().size).toBe(50)
  })

  it('ignores a leftover .tmp file from a crash', async () => {
    const s = await KeyStore.open(dir, plaintextCodec)
    await s.upsert(rec('a'))
    await fs.writeFile(path.join(dir, 'keys.json.tmp'), '{"version":1,"enc')
    const again = await KeyStore.open(dir, plaintextCodec)
    expect(again.get('a')).toEqual(rec('a'))
    await again.upsert(rec('b'))
    expect((await KeyStore.open(dir, plaintextCodec)).all().size).toBe(2)
  })

  it('deleteAll removes the file and empties the store', async () => {
    const s = await KeyStore.open(dir, plaintextCodec)
    await s.upsert(rec('a'))
    await s.deleteAll()
    await expect(fs.stat(path.join(dir, 'keys.json'))).rejects.toThrow()
    expect(s.all().size).toBe(0)
    expect((await KeyStore.open(dir, plaintextCodec)).all().size).toBe(0)
  })

  it('reads a plaintext file even when the codec encrypts', async () => {
    await (await KeyStore.open(dir, plaintextCodec)).upsert(rec('a'))
    const again = await KeyStore.open(dir, reverseCodec)
    expect(again.get('a')).toEqual(rec('a'))
  })

  it('refuses an encrypted file with a plaintext codec', async () => {
    await (await KeyStore.open(dir, reverseCodec)).upsert(rec('a'))
    await expect(KeyStore.open(dir, plaintextCodec)).rejects.toThrow(/encrypted/)
  })
})

describe('SettingsStore', () => {
  it('applies defaults to a partial file', async () => {
    await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify({ autoUpdate: true }))
    const s = await SettingsStore.open(dir)
    expect(s.get()).toEqual({ ...DEFAULT_SETTINGS, autoUpdate: true })
  })

  it('returns defaults when missing and persists updates', async () => {
    const s = await SettingsStore.open(dir)
    expect(s.get()).toEqual(DEFAULT_SETTINGS)
    const next = await s.update({ scheduleHours: 6 })
    expect(next.scheduleHours).toBe(6)
    expect((await SettingsStore.open(dir)).get().scheduleHours).toBe(6)
  })
})
