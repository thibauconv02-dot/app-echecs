import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { extendSolution, findCandidates, verifyCandidate, type Analyser } from '../src/puzzles/generate'
import type { PvLine } from '../src/engine/engine'
import type { MoveClassification } from '../src/lib/classify'

const pv = (cp: number | null, moves: string[], mate: number | null = null, multipv = 1): PvLine => ({ depth: 16, multipv, cp, mate, pv: moves })

/** Fake engine answering from a table keyed by "fen|searchmoves". */
function fake(table: Record<string, PvLine[]>): Analyser {
  return {
    async analyse(fen, _d, opts = {}) {
      const key = `${fen.split(' ').slice(0, 4).join(' ')}|${opts.searchMoves?.join(',') ?? ''}`
      return (table[key] ?? []).slice(0, opts.multiPv ?? 1)
    },
  }
}
const key = (fen: string, search = '') => `${fen.split(' ').slice(0, 4).join(' ')}|${search}`

const mv = (i: number, color: 'white' | 'black', loss: number): MoveClassification => ({
  ply: i + 1, san: '', uci: '', color, category: 'best', winBefore: 50, winAfter: 50, loss, bestMove: null, bestMoveSan: null,
})

describe('findCandidates', () => {
  it('keeps my moves losing ≥ 10 % and types them', () => {
    const moves = [mv(0, 'white', 0), mv(1, 'black', 30), mv(2, 'white', 22), mv(3, 'black', 2), mv(4, 'white', 12), mv(5, 'black', 40), mv(6, 'white', 5)]
    expect(findCandidates(moves, 'white')).toEqual([
      { index: 2, type: 'punish' },
      { index: 4, type: 'avoid' },
    ])
  })
})

// Position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4?: white to move.
const FEN = 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

describe('verifyCandidate', () => {
  it('accepts a clear gap and lists near-equal alternatives', async () => {
    const e = fake({
      [key(FEN)]: [pv(150, ['f3e5', 'd8g5']), pv(140, ['f3d4', 'e5d4'], null, 2), pv(20, ['e1g1'], null, 3)],
      [key(FEN, 'b1c3')]: [pv(-250, ['b1c3'])],
    })
    const v = await verifyCandidate(e, FEN, 'b1c3')
    expect(v).not.toBeNull()
    expect(v!.gap).toBeGreaterThan(20)
    expect(v!.alternatives).toEqual(['f3d4'])
  })

  it('rejects small gaps, decided positions and the move played being best', async () => {
    const small = fake({ [key(FEN)]: [pv(100, ['f3e5'])], [key(FEN, 'b1c3')]: [pv(40, ['b1c3'])] })
    expect(await verifyCandidate(small, FEN, 'b1c3')).toBeNull()
    const stillWinning = fake({ [key(FEN)]: [pv(null, ['f3e5'], 3)], [key(FEN, 'b1c3')]: [pv(900, ['b1c3'])] })
    expect(await verifyCandidate(stillWinning, FEN, 'b1c3')).toBeNull()
    const lost = fake({ [key(FEN)]: [pv(-700, ['f3e5'])], [key(FEN, 'b1c3')]: [pv(null, ['b1c3'], -2)] })
    expect(await verifyCandidate(lost, FEN, 'b1c3')).toBeNull()
    const same = fake({ [key(FEN)]: [pv(150, ['b1c3'])], [key(FEN, 'b1c3')]: [pv(150, ['b1c3'])] })
    expect(await verifyCandidate(same, FEN, 'b1c3')).toBeNull()
  })
})

describe('extendSolution', () => {
  const after = (fen: string, ...ucis: string[]) => {
    const c = new Chess(fen)
    ucis.forEach((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4) }))
    return c.fen()
  }

  it('adds a second move only when it is the only good one', async () => {
    const p2 = after(FEN, 'f3e5', 'd8g5')
    const e = fake({ [key(p2)]: [pv(300, ['e5f7', 'g5g2']), pv(50, ['d2d3'], null, 2)] })
    const r = await extendSolution(e, FEN, pv(150, ['f3e5', 'd8g5', 'e5f7']), 70)
    expect(r.line).toEqual(['f3e5', 'd8g5', 'e5f7'])
    expect(r.stepWins).toHaveLength(2)
    expect(r.continuation[0]).toBe('Qxg2')
  })

  it('stops after one move when several follow-ups are fine', async () => {
    const p2 = after(FEN, 'f3e5', 'd8g5')
    const e = fake({ [key(p2)]: [pv(300, ['e5f7']), pv(280, ['d2d4'], null, 2)] })
    const r = await extendSolution(e, FEN, pv(150, ['f3e5', 'd8g5', 'e5f7']), 70)
    expect(r.line).toEqual(['f3e5'])
    expect(r.continuation.slice(0, 2)).toEqual(['Qg5', 'Nxf7'])
  })
})
