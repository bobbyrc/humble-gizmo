const EDITION_SUFFIXES = [
  'game of the year edition',
  'game of the year',
  'goty edition',
  'goty',
  'definitive edition',
  'complete edition',
  'deluxe edition',
  'enhanced edition',
  'special edition',
  'anniversary edition',
  'remastered',
  'edition'
]
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and'])

// Remove the marks before NFKD, which would turn ™ into the letters "TM".
function fold(s: string): string {
  return s
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** True when normalization discards letters (e.g. kana, ø, ß), so a match is a guess. */
export function normalizationDroppedLetters(s: string): boolean {
  for (const ch of fold(s)) if (/\p{L}/u.test(ch) && !/[a-z]/.test(ch)) return true
  return false
}

/** Lowercased, accent-free, punctuation-free content tokens of a game title. */
export function normalizeTitle(s: string): string[] {
  let t = fold(s)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  let stripped = true
  while (stripped && !EDITION_SUFFIXES.includes(t)) {
    stripped = false
    for (const suffix of EDITION_SUFFIXES) {
      if (t.endsWith(' ' + suffix)) {
        t = t.slice(0, -(suffix.length + 1)).trim()
        stripped = true
        break
      }
    }
  }
  return t.split(' ').filter((w) => w !== '' && !STOPWORDS.has(w))
}
