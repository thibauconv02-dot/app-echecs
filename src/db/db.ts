import Dexie, { type EntityTable } from 'dexie'
import type { TimeClass } from '../config/settings'
import type { MoveClassification } from '../lib/classify'
import type { LineReview } from '../trainer/schedule'
import type { Puzzle } from '../puzzles/types'

export type Outcome = 'win' | 'loss' | 'draw'

export interface GameRecord {
  id: string // Chess.com game uuid
  url: string
  endTime: number // unix seconds
  timeClass: TimeClass | string
  timeControl: string
  rated: boolean
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
  myColor: 'white' | 'black'
  outcome: Outcome
  eco: string | null
  ecoUrl: string | null
  opening: string | null
  initialFen: string
  sans: string[]
  clocks: (number | null)[]
  pgn: string
  analysedDepth: number | null
  /** PUZZLE_VERSION the game was last scanned with for puzzles (undefined = never). */
  puzzleVersion?: number
}

export interface ArchiveRecord {
  url: string // monthly archive URL
  fetchedAt: number // ms
  /** True once the month was fetched after it ended: never fetched again. */
  complete: boolean
  gameCount: number
}

/** Engine evaluation of a position, from the point of view of the side to move. */
export interface EvalRecord {
  fen: string // key: full FEN with move counters stripped (see positionKey)
  depth: number
  cp: number | null
  mate: number | null
  bestMove: string | null // UCI
  pv: string[]
}

export interface AnalysisRecord {
  gameId: string
  depth: number
  createdAt: number
  /** Per position (sans.length + 1), side-to-move point of view. */
  evals: { cp: number | null; mate: number | null; bestMove: string | null }[]
  moves: MoveClassification[]
}

export class AppDB extends Dexie {
  games!: EntityTable<GameRecord, 'id'>
  archives!: EntityTable<ArchiveRecord, 'url'>
  evals!: EntityTable<EvalRecord, 'fen'>
  analyses!: EntityTable<AnalysisRecord, 'gameId'>
  lineReviews!: EntityTable<LineReview, 'lineId'>
  puzzles!: EntityTable<Puzzle, 'id'>
  /** Spaced repetition of puzzles (lineId = puzzle id). */
  puzzleReviews!: EntityTable<LineReview, 'lineId'>

  constructor(name = 'app-echecs') {
    super(name)
    this.version(1).stores({
      games: 'id, endTime, timeClass, myColor, outcome, eco',
      archives: 'url',
      evals: 'fen',
      analyses: 'gameId',
    })
    // v2: compound index for the paginated, filtered games list.
    this.version(2).stores({
      games: 'id, endTime, timeClass, myColor, outcome, eco, [timeClass+endTime]',
    })
    // v3: opening trainer (spaced repetition per repertoire line).
    this.version(3).stores({
      lineReviews: 'lineId, due',
    })
    // v4: puzzles from my games.
    this.version(4).stores({
      puzzles: 'id, gameId, type, phase, family',
      puzzleReviews: 'lineId, due',
    })
  }
}

export const db = new AppDB()
