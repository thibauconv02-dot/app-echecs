import { describe, expect, it } from 'vitest'
import { openingGroup, stripMoves } from '../src/lib/openingFamily'
import { countPieces, phaseOf } from '../src/lib/phase'
import { moveTiming, parseTimeControl } from '../src/lib/clock'
import { gameFacts, openingStats, timeStats, type GameForStats } from '../src/lib/stats'
import type { AnalysisRecord } from '../src/db/db'
import type { MoveCategory } from '../src/lib/classify'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('openingGroup (real Chess.com names)', () => {
  it('strips move sequences', () => {
    expect(stripMoves('Caro Kann Defense Exchange Variation 3...cxd5 4.Nf3')).toBe('Caro Kann Defense Exchange Variation')
    expect(stripMoves('London System...4.e3 Bf5 5.c4 e6')).toBe('London System')
    expect(stripMoves('Indian Game 2.Bf4 e6 3.e3 d5 4.Nf3')).toBe('Indian Game')
  })
  it('groups by family and variation', () => {
    expect(openingGroup('Caro Kann Defense Exchange Variation 3...cxd5 4.Nf3')).toEqual({ family: 'Caro-Kann Defense', variation: 'Exchange Variation' })
    expect(openingGroup('Caro Kann Defense 2.Nf3 d5')).toEqual({ family: 'Caro-Kann Defense', variation: 'Ligne principale' })
    expect(openingGroup('Queens Pawn Opening Zukertort Chigorin Variation 3.Bf4')).toEqual({ family: 'Queen’s Pawn Opening', variation: 'Zukertort Chigorin Variation' })
    expect(openingGroup('Englund Gambit 2.dxe5')).toEqual({ family: 'Englund Gambit', variation: 'Ligne principale' })
    expect(openingGroup('Modern Defense with 1 d4 2.Nf3').family).toBe('Modern Defense')
    expect(openingGroup('Queens Gambit Declined Chigorin Defense 3.Nc3 dxc4').family).toBe('Queen’s Gambit')
  })
  it('merges London variants into one family', () => {
    expect(openingGroup('London System...4.e3 Bf5').family).toBe('London System')
    expect(openingGroup('Indian Game East Indian London System...4.e3 O O').family).toBe('London System')
    expect(openingGroup('Queens Pawn Opening Accelerated London System 2...Nf6').family).toBe('London System')
  })
  it('handles a missing name', () => {
    expect(openingGroup(null).family).toBe('Ouverture inconnue')
  })
})

describe('phaseOf', () => {
  it('counts pieces without kings and pawns', () => {
    expect(countPieces(START)).toBe(14)
    expect(countPieces('8/5p2/4pP2/4k1p1/6Pp/3K3P/8/8 w - - 0 45')).toBe(0)
  })
  it('applies opening / middlegame / endgame rules', () => {
    expect(phaseOf(START, 24)).toBe('opening')
    expect(phaseOf(START, 25)).toBe('middlegame')
    expect(phaseOf('4r1k1/5ppp/8/8/8/2N5/5PPP/3R2K1 w - - 0 30', 59)).toBe('endgame')
  })
})

describe('clock', () => {
  it('parses time controls', () => {
    expect(parseTimeControl('600')).toEqual({ base: 600, increment: 0 })
    expect(parseTimeControl('600+5')).toEqual({ base: 600, increment: 5 })
    expect(parseTimeControl('1/86400')).toBeNull()
  })
  it('computes time before and spent, with increment', () => {
    const clocks = [598, 595, 590, 580, 588]
    const tc = { base: 600, increment: 5 }
    expect(moveTiming(clocks, 0, tc)).toEqual({ before: 600, spent: 7 })
    expect(moveTiming(clocks, 2, tc)).toEqual({ before: 598, spent: 13 })
    expect(moveTiming(clocks, 4, tc)).toEqual({ before: 590, spent: 7 })
    expect(moveTiming([null], 0, tc)).toBeNull()
  })
})

function fakeAnalysis(sans: string[], cats: MoveCategory[], losses: number[]): AnalysisRecord {
  return {
    gameId: 'g',
    depth: 16,
    createdAt: 0,
    evals: [],
    moves: sans.map((san, i) => ({
      ply: i + 1, san, uci: '', color: i % 2 === 0 ? 'white' : 'black', category: cats[i],
      winBefore: 50, winAfter: 50, loss: losses[i], bestMove: null, bestMoveSan: null,
    })),
  }
}

describe('gameFacts / openingStats / timeStats', () => {
  const sans = ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5']
  const game: GameForStats = {
    id: 'g', myColor: 'black', outcome: 'win', opening: 'Caro Kann Defense Exchange Variation 3...cxd5',
    initialFen: START, sans, timeControl: '600', clocks: [599, 598, 597, 540, 596, 538],
  }
  // Black: c6 best, d5 blunder (played with 58 s spent), cxd5 replies to White's blunder exd5.
  const analysis = fakeAnalysis(sans, ['best', 'best', 'best', 'blunder', 'blunder', 'best'], [0, 0, 0, 30, 40, 0])
  const facts = gameFacts(game, analysis)

  it('keeps only my moves and flags critical ones', () => {
    expect(facts.myMoves).toHaveLength(3)
    expect(facts.myMoves.map((m) => m.critical)).toEqual([false, true, true])
    expect(facts.myMoves[1].timing).toEqual({ before: 598, spent: 58 })
    expect(facts.myMoves[2].timing).toEqual({ before: 540, spent: 2 })
    expect(facts.accuracy).toBe(90)
  })

  it('aggregates by opening', () => {
    const lost = { ...facts, gameId: 'h', outcome: 'loss' as const, variation: 'Ligne principale' }
    const [caro] = openingStats([facts, lost])
    expect(caro).toMatchObject({ name: 'Caro-Kann Defense', games: 2, wins: 1, losses: 1, score: 50, blundersPerGame: 1 })
    expect(caro.errorsByPhase.opening).toBe(2)
    expect(caro.variations!.map((v) => v.name)).toEqual(['Exchange Variation', 'Ligne principale'])
  })

  it('computes clock statistics', () => {
    const t = timeStats([facts])
    expect(t).toMatchObject({ moves: 3, blunders: 1, blundersLowClock: 0, critical: 2, criticalFast: 1 })
    expect(t.avgSpentCritical).toBe(30)
  })
})
