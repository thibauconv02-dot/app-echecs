import { describe, expect, it } from 'vitest'
import { moveLoss, winPercent } from '../src/lib/winPercent'
import { categoryFor, classifyGame, summarize, type PositionEval } from '../src/lib/classify'
import { gameFens } from '../src/services/analysis'
import { THRESHOLDS } from '../src/config/classification'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const cp = (v: number, best: string | null = null): PositionEval => ({ cp: v, mate: null, bestMove: best })
const mate = (v: number, best: string | null = null): PositionEval => ({ cp: null, mate: v, bestMove: best })

describe('winPercent', () => {
  it('is 50 at equality and symmetric', () => {
    expect(winPercent({ cp: 0, mate: null })).toBe(50)
    expect(winPercent({ cp: 300, mate: null }) + winPercent({ cp: -300, mate: null })).toBeCloseTo(100)
  })
  it('matches the Lichess formula', () => {
    expect(winPercent({ cp: 100, mate: null })).toBeCloseTo(59.1, 1)
    expect(winPercent({ cp: 1000, mate: null })).toBeCloseTo(97.5, 1)
  })
  it('handles mates', () => {
    expect(winPercent({ cp: null, mate: 3 })).toBe(100)
    expect(winPercent({ cp: null, mate: -1 })).toBe(0)
    expect(winPercent({ cp: null, mate: 0 })).toBe(0) // side to move is checkmated
  })
  it('computes loss from the mover point of view, never negative', () => {
    expect(moveLoss({ cp: 0, mate: null }, { cp: 0, mate: null }).loss).toBe(0)
    expect(moveLoss({ cp: 0, mate: null }, { cp: -200, mate: null }).loss).toBe(0) // move improved
    // Had mate in 2, now opponent is fine: full loss.
    expect(moveLoss({ cp: null, mate: 2 }, { cp: 0, mate: null }).loss).toBe(50)
    // Delivering mate: after = opponent mated (mate 0) → winAfter 100.
    expect(moveLoss({ cp: null, mate: 1 }, { cp: null, mate: 0 }).loss).toBe(0)
  })
})

describe('categoryFor thresholds', () => {
  it('applies boundaries', () => {
    expect(categoryFor(30, true)).toBe('best')
    expect(categoryFor(THRESHOLDS.bestMaxLoss, false)).toBe('best')
    expect(categoryFor(2.01, false)).toBe('good')
    expect(categoryFor(9.99, false)).toBe('good')
    expect(categoryFor(10, false)).toBe('mistake')
    expect(categoryFor(25, false)).toBe('mistake')
    expect(categoryFor(25.01, false)).toBe('blunder')
  })
})

describe('classifyGame', () => {
  const sans = ['f3', 'e5', 'g4', 'Qh4#']
  const fens = gameFens({ initialFen: START, sans })
  const evals = [cp(30, 'e2e4'), cp(60, 'e7e5'), cp(-80, 'd2d4'), mate(1, 'd8h4'), mate(0)]
  const moves = classifyGame(fens, evals, sans)

  it('classifies a fool’s mate', () => {
    expect(moves.map((m) => m.category)).toEqual(['good', 'best', 'blunder', 'best'])
    expect(moves[2]).toMatchObject({ color: 'white', uci: 'g2g4', bestMoveSan: 'd4' })
    expect(moves[3].san).toBe('Qh4#')
  })

  it('summarizes per side', () => {
    const w = summarize(moves, 'white')
    expect(w.counts.blunder).toBe(1)
    expect(w.accuracy).toBeLessThan(80)
    expect(summarize(moves, 'black').counts.best).toBe(2)
  })

  it('lets the repertoire hook label theory', () => {
    const rep = { isTheory: (_f: string, uci: string) => uci === 'f2f3' }
    expect(classifyGame(fens, evals, sans, rep)[0].category).toBe('theory')
  })
})
