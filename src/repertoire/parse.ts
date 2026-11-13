import { parseGames } from '@mliebelt/pgn-parser'
import { Chess } from 'chess.js'
import { positionKey } from '../services/analysis'

export type Side = 'white' | 'black'

/** Annotation symbols kept from the PGN ($1 = !, $2 = ?, …). */
const NAG_SYMBOLS: Record<string, string> = { $1: '!', $2: '?', $3: '!!', $4: '??', $5: '!?', $6: '?!' }

export interface RepMove {
  san: string // English SAN (internal)
  /** "!" / "?" … from $1/$2 NAGs, for display. */
  annotation: string | null
  comment: string | null
}

export interface RepLine {
  /** Stable id: file + moves. Changing the line in the PGN creates a new line. */
  id: string
  fileId: string // e.g. "noirs/caro-kann"
  opening: string // e.g. "Caro-Kann"
  chapter: string // [Event] of the game in the file
  color: Side // side I play
  /** Moves from the start position, trimmed so the line ends on my move. */
  moves: RepMove[]
}

export interface RepFile {
  path: string // e.g. "noirs/caro-kann.pgn"
  content: string
}

const OPENING_NAMES: Record<string, string> = { trompowsky: 'Trompowsky', 'caro-kann': 'Caro-Kann', ragozine: 'Ragozine' }

function openingName(fileName: string): string {
  return OPENING_NAMES[fileName] ?? fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/-/g, ' ')
}

// Minimal view of @mliebelt/pgn-types' PgnMove.
interface PgnMove {
  notation: { notation: string }
  variations: PgnMove[][]
  nag: string[] | null
  commentAfter?: string
  commentMove?: string
}

function toRepMove(m: PgnMove): RepMove {
  const annotation = (m.nag ?? []).map((n) => NAG_SYMBOLS[n]).find(Boolean) ?? null
  const comment = [m.commentMove, m.commentAfter].filter(Boolean).join(' ').trim() || null
  return { san: m.notation.notation, annotation, comment }
}

/** Every root-to-leaf path of a game with variations (a variation replaces the move it is attached to). */
export function extractPaths(moves: PgnMove[], prefix: RepMove[] = []): RepMove[][] {
  const paths: RepMove[][] = []
  const current = [...prefix]
  for (const m of moves) {
    for (const v of m.variations ?? []) paths.push(...extractPaths(v, current))
    current.push(toRepMove(m))
  }
  paths.push(current)
  return paths
}

/** Side of a folder: "blancs" → white, "noirs" → black; [Orientation] tag wins if present. */
function sideOf(path: string, orientation: string | undefined): Side {
  if (orientation === 'white' || orientation === 'black') return orientation
  return path.startsWith('blancs/') ? 'white' : 'black'
}

/** Parse one repertoire file into lines (all chapters). Moves are validated and normalised by chess.js. */
export function parseRepertoireFile(file: RepFile): RepLine[] {
  const fileId = file.path.replace(/\.pgn$/, '')
  const fileName = fileId.split('/').pop()!
  const opening = openingName(fileName)
  const lines: RepLine[] = []
  for (const game of parseGames(file.content)) {
    const tags = (game.tags ?? {}) as Record<string, unknown>
    const color = sideOf(file.path, tags.Orientation as string | undefined)
    const chapter = String(tags.Event ?? opening)
    for (const path of extractPaths(game.moves as unknown as PgnMove[])) {
      const chess = new Chess()
      const moves = path.map((m) => {
        try {
          return { ...m, san: chess.move(m.san).san }
        } catch {
          throw new Error(`${file.path} (${chapter}) : coup illégal ${m.san} après ${chess.history().join(' ')}`)
        }
      })
      // A line may end on an opponent move: review stops on my last move.
      const myParity = color === 'white' ? 0 : 1
      let end = moves.length
      while (end > 0 && (end - 1) % 2 !== myParity) end--
      if (end === 0) continue
      const trimmed = moves.slice(0, end)
      lines.push({ id: `${fileId}:${trimmed.map((m) => m.san).join(' ')}`, fileId, opening, chapter, color, moves: trimmed })
    }
  }
  return lines
}

/** Known continuations of a position (key = first 4 FEN fields), merged over all lines and move orders. */
export interface RepNode {
  moves: Map<string, RepMove> // SAN → move
}

export class RepertoireTree {
  readonly nodes = new Map<string, RepNode>()

  constructor(lines: RepLine[]) {
    for (const line of lines) {
      const chess = new Chess()
      for (const m of line.moves) {
        const key = positionKey(chess.fen())
        const node = this.nodes.get(key) ?? { moves: new Map() }
        if (!node.moves.has(m.san)) node.moves.set(m.san, m)
        this.nodes.set(key, node)
        chess.move(m.san)
      }
    }
  }

  /** Known moves from a position, whatever the move order that led there. */
  movesFrom(fen: string): RepMove[] {
    return [...(this.nodes.get(positionKey(fen))?.moves.values() ?? [])]
  }
}
