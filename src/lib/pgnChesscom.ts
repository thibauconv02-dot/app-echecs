import { Chess } from 'chess.js'

export interface ParsedChesscomPgn {
  headers: Record<string, string>
  /** English SAN, internal representation. */
  sans: string[]
  /** Remaining clock in seconds after each move (same index as `sans`), null when absent. */
  clocks: (number | null)[]
  eco: string | null
  ecoUrl: string | null
  /** Human-readable opening name derived from the ECOUrl slug. */
  opening: string | null
}

const HEADER_RE = /^\[(\w+)\s+"(.*)"\]\s*$/gm
const CLK_RE = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/

export function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const m of pgn.matchAll(HEADER_RE)) headers[m[1]] = m[2]
  return headers
}

/** "0:09:41.3" components → seconds. */
export function clockToSeconds(h: string, m: string, s: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}

/** "…/openings/Queens-Pawn-Opening-Zukertort-Variation-2...e6" → "Queens Pawn Opening Zukertort Variation 2...e6" */
export function openingFromEcoUrl(ecoUrl: string | null | undefined): string | null {
  if (!ecoUrl) return null
  const slug = ecoUrl.split('/openings/')[1]
  if (!slug) return null
  return decodeURIComponent(slug).replace(/-/g, ' ').trim()
}

/**
 * Parse a Chess.com PGN (mainline only, with {[%clk ...]} comments).
 * Moves are validated by chess.js; clocks are read from the comment following each move.
 */
export function parseChesscomPgn(pgn: string): ParsedChesscomPgn {
  const headers = parseHeaders(pgn)
  const movetext = pgn.replace(HEADER_RE, '').trim()

  const sans: string[] = []
  const clocks: (number | null)[] = []
  // Tokenize: comments, move numbers, results, SAN tokens.
  const TOKEN_RE = /\{([^}]*)\}|(\d+\.(?:\.\.)?)|(1-0|0-1|1\/2-1\/2|\*)|([^\s{}]+)/g
  for (const m of movetext.matchAll(TOKEN_RE)) {
    if (m[1] !== undefined) {
      const clk = CLK_RE.exec(m[1])
      if (clk && clocks.length > 0) clocks[clocks.length - 1] = clockToSeconds(clk[1], clk[2], clk[3])
    } else if (m[4] !== undefined) {
      const token = m[4].replace(/[!?]+$/, '')
      if (/^\$\d+$/.test(token)) continue
      sans.push(token)
      clocks.push(null)
    }
  }

  // Validate and normalise SAN through chess.js.
  const chess = new Chess(headers.FEN || undefined)
  const normalised = sans.map((san) => chess.move(san).san)

  const ecoUrl = headers.ECOUrl ?? null
  return {
    headers,
    sans: normalised,
    clocks,
    eco: headers.ECO ?? null,
    ecoUrl,
    opening: openingFromEcoUrl(ecoUrl),
  }
}
