import { describe, expect, it } from 'vitest'
import { parseBestMove, parseInfo } from '../src/engine/uci'

describe('UCI parsing', () => {
  it('parses a cp info line', () => {
    const i = parseInfo('info depth 16 seldepth 22 multipv 1 score cp -34 nodes 123 nps 1 hashfull 3 time 40 pv e7e5 g1f3 b8c6')
    expect(i).toEqual({ depth: 16, multipv: 1, cp: -34, mate: null, pv: ['e7e5', 'g1f3', 'b8c6'] })
  })
  it('parses mate scores and bounds', () => {
    expect(parseInfo('info depth 5 multipv 1 score mate -2 nodes 1 pv a1a2')!.mate).toBe(-2)
    const b = parseInfo('info depth 9 score cp 50 lowerbound nodes 10 pv e2e4')!
    expect(b.cp).toBe(50)
    expect(b.pv).toEqual(['e2e4'])
  })
  it('ignores lines without score', () => {
    expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull()
    expect(parseInfo('info string NNUE evaluation using nn.nnue')).toBeNull()
  })
  it('parses bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4')
    expect(parseBestMove('bestmove (none)')).toBeNull()
    expect(parseBestMove('info depth 1')).toBeUndefined()
  })
})
