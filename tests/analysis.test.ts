import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { AppDB } from '../src/db/db'
import { evaluateGame, positionKey, type Evaluator } from '../src/services/analysis'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function fakeEngine(calls: string[]): Evaluator {
  return {
    async evaluate(fen, depth) {
      calls.push(fen)
      return { depth, cp: 20, mate: null, bestMove: 'e2e4', pv: ['e2e4'] }
    },
  }
}

describe('evaluateGame', () => {
  it('evaluates each distinct position once and reuses the cache', async () => {
    const db = new AppDB(`a-${Math.random()}`)
    const calls: string[] = []
    // Knights out and back: start position appears twice (different move counters).
    const game = { initialFen: START, sans: ['Nf3', 'Nf6', 'Ng1', 'Ng8'] }
    const r = await evaluateGame(db, fakeEngine(calls), game, 12)
    expect(r.evals).toHaveLength(5)
    expect(calls).toHaveLength(4) // last position = start position, served from cache
    calls.length = 0
    await evaluateGame(db, fakeEngine(calls), game, 12)
    expect(calls).toHaveLength(0)
    // Deeper request re-analyses.
    await evaluateGame(db, fakeEngine(calls), game, 18)
    expect(calls).toHaveLength(4)
  })

  it('scores checkmate without the engine', async () => {
    const db = new AppDB(`b-${Math.random()}`)
    const calls: string[] = []
    const r = await evaluateGame(db, fakeEngine(calls), { initialFen: START, sans: ['f3', 'e5', 'g4', 'Qh4#'] }, 10)
    expect(r.evals[4]).toMatchObject({ mate: 0, bestMove: null })
    expect(calls).toHaveLength(4)
  })

  it('keys positions without move counters', () => {
    expect(positionKey(START)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')
  })
})
