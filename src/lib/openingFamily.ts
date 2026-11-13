import { OPENING_FAMILY_KEYWORDS, OPENING_FAMILY_OVERRIDES } from '../config/stats'

export interface OpeningGroup {
  family: string
  variation: string
}

export const MAIN_LINE = 'Ligne principale'
export const UNKNOWN_OPENING = 'Ouverture inconnue'

/** Remove trailing move sequences: "Exchange Variation 3...cxd5 4.Nf3" → "Exchange Variation". */
export function stripMoves(name: string): string {
  return name.split(/\.\.\.|\s\d+\./)[0].trim()
}

/** Restore apostrophes and hyphens lost in Chess.com URL slugs. */
export function prettify(name: string): string {
  return name
    .replace(/\bCaro Kann\b/g, 'Caro-Kann')
    .replace(/\bQueens\b/g, 'Queen’s')
    .replace(/\bKings\b/g, 'King’s')
    .replace(/\bO O O\b/g, 'O-O-O')
    .replace(/\bO O\b/g, 'O-O')
}

/**
 * Two-level grouping of a Chess.com opening name (from the ECOUrl slug).
 * Family = up to the first keyword (Defense, Opening, Gambit…), unless an override matches.
 */
export function openingGroup(opening: string | null): OpeningGroup {
  if (!opening) return { family: UNKNOWN_OPENING, variation: MAIN_LINE }
  const base = stripMoves(opening)
  if (!base) return { family: UNKNOWN_OPENING, variation: MAIN_LINE }

  const override = OPENING_FAMILY_OVERRIDES.find((o) => base.includes(o.match))
  if (override) {
    const variation = base === override.family ? MAIN_LINE : base
    return { family: prettify(override.family), variation: prettify(variation) }
  }

  const words = base.split(/\s+/)
  const idx = words.findIndex((w) => OPENING_FAMILY_KEYWORDS.includes(w))
  const cut = idx === -1 ? Math.min(2, words.length) : idx + 1
  const family = words.slice(0, cut).join(' ')
  const variation = words.slice(cut).join(' ') || MAIN_LINE
  return { family: prettify(family), variation: prettify(variation) }
}
