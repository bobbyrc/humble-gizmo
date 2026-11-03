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

/** Lowercased, accent-free, punctuation-free content tokens of a game title. */
export function normalizeTitle(s: string): string[] {
  // Remove the marks before NFKD, which would turn ™ into the letters "TM".
  let t = s
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  let stripped = true
  while (stripped) {
    stripped = false
    for (const suffix of EDITION_SUFFIXES) {
      if (t === suffix) continue // never strip the whole title away
      if (t.endsWith(' ' + suffix)) {
        t = t.slice(0, -(suffix.length + 1)).trim()
        stripped = true
        break
      }
    }
  }
  return t.split(' ').filter((w) => w !== '' && !STOPWORDS.has(w))
}
