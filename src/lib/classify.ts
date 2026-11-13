import { Chess } from 'chess.js'
import { THRESHOLDS } from '../config/classification'
import { emptyRepertoire, type RepertoireLookup } from '../repertoire'
import { moveLoss, type Score } from './winPercent'

export type MoveCategory = 'theory' | 'best' | 'good' | 'mistake' | 'blunder'

export interface MoveClassification {
  ply: number // 1-based
  san: string
  uci: string
  color: 'white' | 'black'
  category: MoveCategory
  winBefore: number
  winAfter: number
  loss: number
  /** Engine's best move in the position before the move (UCI / SAN). */
  bestMove: string | null
  bestMoveSan: string | null
}

export interface PositionEval extends Score {
  bestMove: string | null
}

/** Category from loss and whether the move is Stockfish's choice (theory is decided earlier). */
export function categoryFor(loss: number, isEngineMove: boolean): Exclude<MoveCategory, 'theory'> {
  if (isEngineMove || loss <= THRESHOLDS.bestMaxLoss) return 'best'
  if (loss < THRESHOLDS.goodMaxLoss) return 'good'
  if (loss <= THRESHOLDS.mistakeMaxLoss) return 'mistake'
  return 'blunder'
}

export function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

/**
 * Classify every move. `fens[i]`/`evals[i]` describe the position before move i+1
 * (evals from the side to move's point of view); there are sans.length + 1 positions.
 */
export function classifyGame(
  fens: string[],
  evals: PositionEval[],
  sans: string[],
  repertoire: RepertoireLookup = emptyRepertoire,
): MoveClassification[] {
  const out: MoveClassification[] = []
  for (let i = 0; i < sans.length; i++) {
    const chess = new Chess(fens[i])
    const color = chess.turn() === 'w' ? 'white' : 'black'
    const move = chess.move(sans[i])
    const uci = move.from + move.to + (move.promotion ?? '')
    const { winBefore, winAfter, loss } = moveLoss(evals[i], evals[i + 1])
    const bestMove = evals[i].bestMove
    const category: MoveCategory = repertoire.isTheory(fens[i], uci, color)
      ? 'theory'
      : categoryFor(loss, bestMove === uci)
    out.push({
      ply: i + 1,
      san: move.san,
      uci,
      color,
      category,
      winBefore,
      winAfter,
      loss,
      bestMove,
      bestMoveSan: uciToSan(fens[i], bestMove),
    })
  }
  return out
}

export interface SideSummary {
  counts: Record<MoveCategory, number>
  /**
   * Accuracy = 100 − mean loss (win% points) over that side's moves, clamped to [0, 100].
   * Simple, readable average; deliberately not Chess.com's formula.
   */
  accuracy: number | null
}

export function summarize(moves: MoveClassification[], color: 'white' | 'black'): SideSummary {
  const mine = moves.filter((m) => m.color === color)
  const counts: Record<MoveCategory, number> = { theory: 0, best: 0, good: 0, mistake: 0, blunder: 0 }
  for (const m of mine) counts[m.category]++
  const accuracy = mine.length
    ? Math.min(100, Math.max(0, 100 - mine.reduce((s, m) => s + m.loss, 0) / mine.length))
    : null
  return { counts, accuracy }
}
