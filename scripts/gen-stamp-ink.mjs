// Generates src/renderer/assets/stamp-ink.png: a deterministic 256x96 white RGBA ink-wear mask for .stamp. Re-runnable: `node scripts/gen-stamp-ink.mjs`.
/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain JS script; return types cannot be written */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const W = 256
const H = 96
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/renderer/assets/stamp-ink.png')

// mulberry32: small seeded PRNG so the output is the same on every run.
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(7)
const alpha = new Uint8Array(W * H).fill(255)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const put = (x, y, value) => {
  const i = (((y % H) + H) % H) * W + (((x % W) + W) % W)
  if (value < alpha[i]) alpha[i] = value
}

for (let n = 0; n < 900; n++) {
  const cx = rand() * W
  const cy = rand() * H
  const r = 0.6 + rand() * 1.2
  const a = 0.25 + rand() * 0.5
  // Unwrapped pixel coordinates keep distances correct across the tile seam; put() wraps the storage.
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x - cx, y - cy)
      const f = clamp01(1 - (d - r))
      put(x, y, Math.round(255 * (1 - (1 - a) * f)))
    }
  }
}

for (let n = 0; n < 6; n++) {
  const sx = rand() * W
  const sy = rand() * H
  const len = 20 + rand() * 40
  const theta = -0.15 + rand() * 0.3
  for (let t = 0; t <= len; t += 0.5) {
    put(
      Math.floor(sx + Math.cos(theta) * t),
      Math.floor(sy + Math.sin(theta) * t),
      Math.round(255 * 0.55)
    )
  }
}

// PNG encoding: 8-bit RGBA (colour type 6), filter byte 0 on every scanline.
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) {
  const row = y * (W * 4 + 1)
  raw[row] = 0
  for (let x = 0; x < W; x++) {
    const o = row + 1 + x * 4
    raw[o] = 255
    raw[o + 1] = 255
    raw[o + 2] = 255
    raw[o + 3] = alpha[y * W + x]
  }
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0)
  return Buffer.concat([head, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // colour type: RGBA
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter method
ihdr[12] = 0 // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, png)
console.log(`wrote ${OUT} (${png.length} bytes)`)
