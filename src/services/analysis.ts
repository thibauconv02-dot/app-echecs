import { Chess } from 'chess.js'
import type { AnalysisRecord, AppDB, EvalRecord, GameRecord } from '../db/db'
import { classifyGame } from '../lib/classify'
import type { RepertoireLookup } from '../repertoire'
import type { EngineEval } from '../engine/uci'

/** Something able to evaluate a FEN (the real Engine, or a fake in tests). */
export interface Evaluator {
  evaluate(fen: string, depth: number): Promise<EngineEval>
}

/**
 * Cache key: the first 4 FEN fields (pieces, side to move, castling, en passant).
 * Move counters are dropped so that transpositions and repeated positions share one entry.
 */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

/** All FENs of a game: index 0 = start position, index i = after move i. */
export function gameFens(game: Pick<GameRecord, 'initialFen' | 'sans'>): string[] {
  const chess = new Chess(game.initialFen)
  const fens = [chess.fen()]
  for (const san of game.sans) {
    chess.move(san)
    fens.push(chess.fen())
  }
  return fens
}

/** Terminal positions are scored without the engine. */
function terminalEval(fen: string): EngineEval | null {
  const c = new Chess(fen)
  if (c.isCheckmate()) return { depth: 0, cp: null, mate: 0, bestMove: null, pv: [] }
  if (c.isStalemate() || c.isInsufficientMaterial()) return { depth: 0, cp: 0, mate: null, bestMove: null, pv: [] }
  return null
}

/**
 * Evaluate one position, using the IndexedDB cache when an entry of sufficient depth exists.
 * Each position is analysed at most once per depth.
 */
export async function evaluatePosition(db: AppDB, engine: Evaluator, fen: string, depth: number): Promise<EngineEval> {
  const terminal = terminalEval(fen)
  if (terminal) return terminal
  const key = positionKey(fen)
  const cached = await db.evals.get(key)
  if (cached && cached.depth >= depth) return cached
  const ev = await engine.evaluate(fen, depth)
  const record: EvalRecord = { fen: key, depth: ev.depth || depth, cp: ev.cp, mate: ev.mate, bestMove: ev.bestMove, pv: ev.pv.slice(0, 8) }
  await db.evals.put(record)
  return record
}

/** Evaluate every position of a game, in order. */
export async function evaluateGame(
  db: AppDB,
  engine: Evaluator,
  game: Pick<GameRecord, 'initialFen' | 'sans'>,
  depth: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ fens: string[]; evals: EngineEval[] }> {
  const fens = gameFens(game)
  const evals: EngineEval[] = []
  for (let i = 0; i < fens.length; i++) {
    onProgress?.(i, fens.length)
    evals.push(await evaluatePosition(db, engine, fens[i], depth))
  }
  onProgress?.(fens.length, fens.length)
  return { fens, evals }
}

/**
 * Full analysis of a stored game: evaluate (with cache), classify, persist.
 * The repertoire hook is passed through so step 2 can plug in "Théorie".
 */
export async function analyseGame(
  db: AppDB,
  engine: Evaluator,
  game: GameRecord,
  depth: number,
  onProgress?: (done: number, total: number) => void,
  repertoire?: RepertoireLookup,
): Promise<AnalysisRecord> {
  const { fens, evals } = await evaluateGame(db, engine, game, depth, onProgress)
  const moves = classifyGame(fens, evals, game.sans, repertoire)
  const record: AnalysisRecord = {
    gameId: game.id,
    depth,
    createdAt: Date.now(),
    evals: evals.map(({ cp, mate, bestMove }) => ({ cp, mate, bestMove })),
    moves,
  }
  await db.transaction('rw', db.analyses, db.games, async () => {
    await db.analyses.put(record)
    await db.games.update(game.id, { analysedDepth: depth })
  })
  return record
}
