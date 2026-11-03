import type { HumbleKey, Ownership } from '../shared/types'
import type { ExportOptions } from '../shared/ipc'

const BOM = '﻿'
const HEADER = 'name,key,is_gift,key_type,is_expired,steam_owned'

const STEAM_OWNED_LABEL: Record<Ownership, string> = {
  owned: 'yes',
  maybe: 'maybe',
  not_owned: 'no'
}

export function selectExportKeys(keys: HumbleKey[], opts: ExportOptions): HumbleKey[] {
  return keys.filter((key) => {
    if (opts.steamOnly && !key.isSteam) return false
    const revealed = Boolean(key.revealedKey)
    if (revealed ? !opts.includeRevealed : !opts.includeUnrevealed) return false
    return true
  })
}

// RFC 4180: quote fields containing comma, double quote, CR or LF; double inner quotes.
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function steamOwnedLabel(key: HumbleKey, ownership: Map<string, Ownership> | null): string {
  if (ownership === null || !key.isSteam) return ''
  const state = ownership.get(key.id)
  return state === undefined ? '' : STEAM_OWNED_LABEL[state]
}

export function toExportCsv(keys: HumbleKey[], ownership: Map<string, Ownership> | null): string {
  const lines = [HEADER]
  for (const key of keys) {
    const fields = [
      key.name,
      key.revealedKey ?? '',
      String(key.isGift),
      key.keyTypeName,
      String(key.isExpired),
      steamOwnedLabel(key, ownership)
    ]
    lines.push(fields.map(escapeField).join(','))
  }
  return BOM + lines.map((line) => `${line}\r\n`).join('')
}
