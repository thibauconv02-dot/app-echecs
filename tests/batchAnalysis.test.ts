import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { AppDB, type GameRecord } from '../src/db/db'
import { BatchAnalyser } from '../src/services/batchAnalysis'
import type { Evaluator } from '../src/services/analysis'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function game(id: string, endTime: number, timeClass = 'rapid', analysedDepth: number | null = null): GameRecord {
  const p = { username: 'x', rating: 1800, result: 'win' }
  return {
    id, url: '', endTime, timeClass, timeControl: '600', rated: true, white: p, black: { ...p, username: 'opp', result: 'resigned' },
    myColor: 'white', outcome: 'win', eco: null, ecoUrl: null, opening: null, initialFen: START,
    sans: ['e4', 'e5'], clocks: [599, 598], pgn: '', analysedDepth,
  }
}

const engine: Evaluator = { evaluate: async (_f, depth) => ({ depth, cp: 10, mate: null, bestMove: 'e2e4', pv: [] }) }

describe('BatchAnalyser', () => {
  it('analyses the N most recent games of the class, skipping analysed ones', async () => {
    const db = new AppDB(`batch-${Math.random()}`)
    await db.games.bulkAdd([game('old', 1), game('mid', 2), game('new', 3, 'rapid', 16), game('blitz', 4, 'blitz'), game('newest', 5)])
    const b = new BatchAnalyser(db, () => engine)
    expect(await b.pendingGames(3, 'rapid', 16)).toEqual(['newest', 'mid'])
    await b.start(3, 'rapid', 16)
    expect(b.getState().finished).toEqual({ analysed: 2, stopped: false })
    expect((await db.games.get('mid'))!.analysedDepth).toBe(16)
    expect(await db.analyses.get('old')).toBeUndefined()
  })

  it('stops between positions', async () => {
    const db = new AppDB(`batch-${Math.random()}`)
    await db.games.bulkAdd([game('a', 1), game('b', 2)])
    let b: BatchAnalyser
    const slow: Evaluator = {
      evaluate: async (fen, depth) => {
        b.stop()
        return engine.evaluate(fen, depth)
      },
    }
    b = new BatchAnalyser(db, () => slow)
    await b.start(10, 'rapid', 16)
    expect(b.getState()).toMatchObject({ running: false, error: null, finished: { analysed: 0, stopped: true } })
    expect(await db.analyses.count()).toBe(0)
  })
})
