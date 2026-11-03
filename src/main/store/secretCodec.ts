import { safeStorage } from 'electron'
import { plaintextCodec, type SecretCodec } from './codec'

export type { SecretCodec }

/**
 * Encrypts with the OS keychain via Electron safeStorage. Falls back to plaintext when no
 * keychain is available, or on Linux when safeStorage would only obfuscate ('basic_text').
 * Call after the app is ready.
 */
export function createSafeStorageCodec(): SecretCodec {
  if (!safeStorage.isEncryptionAvailable()) return plaintextCodec
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    return plaintextCodec
  }
  return {
    encrypted: true,
    encode: (s) => safeStorage.encryptString(s).toString('base64'),
    decode: (s) => safeStorage.decryptString(Buffer.from(s, 'base64'))
  }
}
