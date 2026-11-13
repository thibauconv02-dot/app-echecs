import type { AnalysisRecord, GameRecord } from '../db/db'
import { FAST_MOVE_SECONDS, LOW_CLOCK_SECONDS } from '../config/stats'
import { summarize, type MoveCategory } from './classify'
import { moveTiming, parseTimeControl } from './clock'
import { openingGroup } from './openingFamily'
import { phaseOf, type Phase } from './phase'
import { gameFens } from '../services/analysis'

export type GameForStats = Pick<GameRecord, 'id' | 'myColor' | 'outcome' | 'opening' | 'initialFen' | 'sans' | 'clocks' | 'timeControl'>

const isError = (c: MoveCategory | undefined) => c === 'mistake' || c === 'blunder'

/** One of *my* moves, with everything the statistics need. */
export interface MyMoveFact {
  category: MoveCategory
  phase: Phase
  /** Time left before the move and time spent on it (seconds); null without clock data. */
  timing: { before: number; spent: number } | null
  /**
   * Critical move = my mistakes and blunders, plus my replies to an opponent's mistake or blunder
   * (a chance to punish). Approximation chosen because the engine runs with MultiPV 1.
   */
  critical: boolean
}

export interface GameFacts {
  gameId: string
  outcome: GameRecord['outcome']
  family: string
  variation: string
  accuracy: number | null
  myMoves: MyMoveFact[]
}

export function gameFacts(game: GameForStats, analysis: AnalysisRecord): GameFacts {
  const fens = gameFens(game)
  const tc = parseTimeControl(game.timeControl)
  const moves = analysis.moves
  const myMoves: MyMoveFact[] = []
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    if (m.color !== game.myColor) continue
    myMoves.push({
      category: m.category,
      phase: phaseOf(fens[i], m.ply),
      timing: tc ? moveTiming(game.clocks, i, tc) : null,
      critical: isError(m.category) || isError(moves[i - 1]?.category),
    })
  }
  const { family, variation } = openingGroup(game.opening)
  return {
    gameId: game.id,
    outcome: game.outcome,
    family,
    variation,
    accuracy: summarize(moves, game.myColor).accuracy,
    myMoves,
  }
}

export interface OpeningStats {
  name: string
  games: number
  wins: number
  draws: number
  losses: number
  /** Points scored, in % (win = 1, draw = ½). */
  score: number
  accuracy: number | null
  mistakesPerGame: number
  blundersPerGame: number
  /** Mistakes + blunders by phase (totals over the games). */
  errorsByPhase: Record<Phase, number>
  variations?: OpeningStats[]
}

function aggregate(name: string, games: GameFacts[]): OpeningStats {
  const wins = games.filter((g) => g.outcome === 'win').length
  const draws = games.filter((g) => g.outcome === 'draw').length
  const accs = games.map((g) => g.accuracy).filter((a): a is number => a !== null)
  const errorsByPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 }
  let mistakes = 0
  let blunders = 0
  for (const g of games)
    for (const m of g.myMoves) {
      if (m.category === 'mistake') mistakes++
      if (m.category === 'blunder') blunders++
      if (isError(m.category)) errorsByPhase[m.phase]++
    }
  const n = games.length
  return {
    name,
    games: n,
    wins,
    draws,
    losses: n - wins - draws,
    score: n ? ((wins + draws / 2) / n) * 100 : 0,
    accuracy: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null,
    mistakesPerGame: n ? mistakes / n : 0,
    blundersPerGame: n ? blunders / n : 0,
    errorsByPhase,
  }
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    map.set(k, [...(map.get(k) ?? []), it])
  }
  return map
}

/** Families sorted by number of games, each with its variations. */
export function openingStats(games: GameFacts[]): OpeningStats[] {
  return [...groupBy(games, (g) => g.family)]
    .map(([family, gs]) => ({
      ...aggregate(family, gs),
      variations: [...groupBy(gs, (g) => g.variation)].map(([v, vs]) => aggregate(v, vs)).sort((a, b) => b.games - a.games),
    }))
    .sort((a, b) => b.games - a.games)
}

export interface TimeStats {
  /** My moves with clock data. */
  moves: number
  blunders: number
  blundersLowClock: number
  /** Share of all my moves played with less than LOW_CLOCK_SECONDS left, for comparison. */
  movesLowClock: number
  critical: number
  criticalFast: number
  avgSpentCritical: number | null
  avgSpentAll: number | null
}

export function timeStats(games: GameFacts[]): TimeStats {
  const timed = games.flatMap((g) => g.myMoves).filter((m) => m.timing !== null) as (MyMoveFact & { timing: { before: number; spent: number } })[]
  const blunders = timed.filter((m) => m.category === 'blunder')
  const critical = timed.filter((m) => m.critical)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  return {
    moves: timed.length,
    blunders: blunders.length,
    blundersLowClock: blunders.filter((m) => m.timing.before < LOW_CLOCK_SECONDS).length,
    movesLowClock: timed.filter((m) => m.timing.before < LOW_CLOCK_SECONDS).length,
    critical: critical.length,
    criticalFast: critical.filter((m) => m.timing.spent < FAST_MOVE_SECONDS).length,
    avgSpentCritical: avg(critical.map((m) => m.timing.spent)),
    avgSpentAll: avg(timed.map((m) => m.timing.spent)),
  }
}
