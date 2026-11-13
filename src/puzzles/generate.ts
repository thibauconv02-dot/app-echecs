import { Chess } from 'chess.js'
import {
  ALT_TOLERANCE, CANDIDATE_MIN_LOSS, MAX_MY_MOVES, MAX_PLAYED_WIN, MIN_BEST_WIN, MIN_GAP,
  ONLY_MOVE_GAP, OPPONENT_BLUNDER_MIN_LOSS, SCAN_DEPTH, VERIFY_DEPTH,
} from '../config/puzzles'
import type { AppDB, GameRecord } from '../db/db'
import type { AnalyseOptions, PvLine } from '../engine/engine'
import { classifyGame, type MoveClassification } from '../lib/classify'
import { openingGroup } from '../lib/openingFamily'
import { phaseOf } from '../lib/phase'
import { winPercent } from '../lib/winPercent'
import { evaluateGame, type Evaluator } from '../services/analysis'
import type { Puzzle, PuzzleType } from './types'

export interface Analyser {
  analyse(fen: string, depth: number, opts?: AnalyseOptions): Promise<PvLine[]>
}
export type PuzzleEngine = Evaluator & Analyser

export interface Candidate {
  index: number // move index (0-based) of my move
  type: PuzzleType
}

/** My moves that lost enough in the scan; "punish" when the opponent's previous move was a big error. */
export function findCandidates(moves: MoveClassification[], myColor: 'white' | 'black'): Candidate[] {
  const out: Candidate[] = []
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i]
    if (m.color !== myColor || m.loss < CANDIDATE_MIN_LOSS) continue
    out.push({ index: i, type: moves[i - 1].loss >= OPPONENT_BLUNDER_MIN_LOSS ? 'punish' : 'avoid' })
  }
  return out
}

export interface Verified {
  best: PvLine
  bestWin: number
  playedWin: number
  gap: number
  alternatives: string[]
}

/**
 * Deeper check of one candidate. Best moves and the move actually played are scored
 * in the same position at the same depth, so the comparison is consistent.
 * Returns null when the puzzle would be unfair or pointless.
 */
export async function verifyCandidate(engine: Analyser, fen: string, playedUci: string): Promise<Verified | null> {
  const lines = await engine.analyse(fen, VERIFY_DEPTH, { multiPv: 3 })
  const [played] = await engine.analyse(fen, VERIFY_DEPTH, { searchMoves: [playedUci] })
  if (!lines.length || !played || lines[0].pv[0] === playedUci) return null
  const bestWin = winPercent(lines[0])
  const playedWin = winPercent(played)
  const gap = bestWin - playedWin
  if (gap < MIN_GAP) return null // not a clear mistake
  if (playedWin >= MAX_PLAYED_WIN) return null // still winning anyway
  if (bestWin <= MIN_BEST_WIN) return null // lost anyway
  const alternatives = lines
    .slice(1)
    .filter((l) => bestWin - winPercent(l) <= ALT_TOLERANCE && l.pv[0] !== playedUci)
    .map((l) => l.pv[0])
  return { best: lines[0], bestWin, playedWin, gap, alternatives }
}

function playUci(chess: Chess, uci: string): string | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

/**
 * Extend the solution to 2–3 moves while each next move of mine is clearly the only good one.
 * The opponent's replies are the engine's best replies.
 */
export async function extendSolution(
  engine: Analyser,
  fen: string,
  first: PvLine,
  bestWin: number,
): Promise<{ line: string[]; stepWins: number[]; continuation: string[] }> {
  const chess = new Chess(fen)
  const line = [first.pv[0]]
  const stepWins = [bestWin]
  playUci(chess, first.pv[0])
  let current = first
  while (stepWins.length < MAX_MY_MOVES && !chess.isGameOver()) {
    const reply = current.pv[1]
    if (!reply) break
    const probe = new Chess(chess.fen())
    if (!playUci(probe, reply) || probe.isGameOver()) break
    const next = await engine.analyse(probe.fen(), VERIFY_DEPTH, { multiPv: 2 })
    if (next.length < 2) break // forced or no data: nothing to find
    const w0 = winPercent(next[0])
    if (w0 - winPercent(next[1]) < ONLY_MOVE_GAP) break // several good moves: stop here
    playUci(chess, reply)
    playUci(chess, next[0].pv[0])
    line.push(reply, next[0].pv[0])
    stepWins.push(w0)
    current = next[0]
  }
  // Engine continuation after the last solution move, for display.
  const continuation: string[] = []
  for (const uci of current.pv.slice(1, 7)) {
    const san = playUci(chess, uci)
    if (!san) break
    continuation.push(san)
  }
  return { line, stepWins, continuation }
}

/**
 * Scan a game quickly, verify the candidates deeply and save the resulting puzzles.
 * Existing puzzles (and the "wrong puzzle" flag) are kept.
 */
export async function generatePuzzlesForGame(
  db: AppDB,
  engine: PuzzleEngine,
  game: GameRecord,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Puzzle[]> {
  const { fens, evals } = await evaluateGame(db, engine, game, SCAN_DEPTH, (d, t) => onProgress?.(d, t + 1), signal)
  const moves = classifyGame(fens, evals, game.sans)
  const candidates = findCandidates(moves, game.myColor)
  const total = fens.length + candidates.length
  const { family } = openingGroup(game.opening)
  const created: Puzzle[] = []
  for (let c = 0; c < candidates.length; c++) {
    signal?.throwIfAborted()
    onProgress?.(fens.length + c, total)
    const { index, type } = candidates[c]
    const id = `${game.id}:${index + 1}`
    if (await db.puzzles.get(id)) continue
    const fen = fens[index]
    const v = await verifyCandidate(engine, fen, moves[index].uci)
    if (!v) continue
    const { line, stepWins, continuation } = await extendSolution(engine, fen, v.best, v.bestWin)
    const puzzle: Puzzle = {
      id,
      gameId: game.id,
      ply: index + 1,
      type,
      color: game.myColor,
      fenBefore: fens[index - 1],
      opponentMove: moves[index - 1].uci,
      fen,
      line,
      stepWins,
      alternatives: v.alternatives,
      continuation,
      played: { uci: moves[index].uci, san: moves[index].san, win: v.playedWin },
      gap: v.gap,
      family,
      phase: phaseOf(fen, index + 1),
      endTime: game.endTime,
      createdAt: Date.now(),
      disabled: false,
    }
    await db.puzzles.put(puzzle)
    created.push(puzzle)
  }
  onProgress?.(total, total)
  return created
}
