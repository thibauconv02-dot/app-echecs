import { describe, expect, it } from 'vitest'
import { parseChesscomPgn, openingFromEcoUrl } from '../src/lib/pgnChesscom'
import fixture from './fixtures/chesscom-archive.json'

const game = fixture.games[0]

describe('parseChesscomPgn (real Chess.com PGN)', () => {
  const parsed = parseChesscomPgn(game.pgn)

  it('reads headers, ECO and opening', () => {
    expect(parsed.headers.White).toBe('AnakinSkywalker25')
    expect(parsed.eco).toBe('D02')
    expect(parsed.ecoUrl).toBe(game.eco)
    expect(parsed.opening).toBe('Queens Pawn Opening Zukertort Variation 2...e6 3.Bf4 Bd6 4.Bg3')
  })

  it('reads every move and its clock', () => {
    expect(parsed.sans.slice(0, 4)).toEqual(['d4', 'd5', 'Nf3', 'e6'])
    expect(parsed.clocks.length).toBe(parsed.sans.length)
    expect(parsed.clocks[0]).toBeCloseTo(599.9)
    expect(parsed.clocks[1]).toBeCloseTo(597.5)
    expect(parsed.clocks.every((c) => c !== null)).toBe(true)
  })

  it('ends at the position reported by Chess.com', async () => {
    const { Chess } = await import('chess.js')
    const c = new Chess()
    parsed.sans.forEach((s) => c.move(s))
    expect(c.fen()).toBe(game.fen)
  })

  it('parses a clock with hours', () => {
    const p = parseChesscomPgn('[Event "x"]\n\n1. e4 {[%clk 1:02:03.5]} 1... e5 {[%clk 0:00:04]} *')
    expect(p.clocks).toEqual([3723.5, 4])
  })
})

describe('openingFromEcoUrl', () => {
  it('handles missing values', () => {
    expect(openingFromEcoUrl(null)).toBeNull()
    expect(openingFromEcoUrl('https://www.chess.com/openings/Caro-Kann-Defense')).toBe('Caro Kann Defense')
  })
})
