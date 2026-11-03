/** Encodes secrets (revealed game keys) before they are written to disk. Must not import electron. */
export interface SecretCodec {
  readonly encrypted: boolean
  encode(s: string): string
  decode(s: string): string
}

export const plaintextCodec: SecretCodec = {
  encrypted: false,
  encode: (s) => s,
  decode: (s) => s
}
