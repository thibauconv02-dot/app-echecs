import Dexie, { type EntityTable } from 'dexie'
import type { TimeClass } from '../config/settings'
import type { MoveClassification } from '../lib/classify'

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
  }
}

export const db = new AppDB()
