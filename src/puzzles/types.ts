import type { Phase } from '../lib/phase'

export type PuzzleType = 'punish' | 'avoid'

export interface Puzzle {
  id: string // `${gameId}:${ply}`
  gameId: string
  /** Ply (1-based) of my move in the game. */
  ply: number
  type: PuzzleType
  color: 'white' | 'black'
  /** Position before the opponent's move that leads to the puzzle (shown first, then animated). */
  fenBefore: string
  opponentMove: string // UCI
  /** Puzzle position: my move to find. */
  fen: string
  /** Solution from `fen`, UCI: my move, reply, my move… (always ends on my move). */
  line: string[]
  /** Win% (my point of view) of the best move at each of my steps, for checking other moves. */
  stepWins: number[]
  /** Other first moves accepted as correct (within ALT_TOLERANCE of the best). */
  alternatives: string[]
  /** Engine continuation after the solution, SAN, for display. */
  continuation: string[]
  /** What I played in the game, and its win%. */
  played: { uci: string; san: string; win: number }
  gap: number
  family: string
  phase: Phase
  endTime: number
  createdAt: number
  /** Marked as wrong by the user ("Ce puzzle est faux"): never shown again. */
  disabled: boolean
}
