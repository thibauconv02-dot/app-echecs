import { describe, expect, it } from 'vitest'
import { soundForChange } from '../src/lib/sound'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('soundForChange', () => {
  it('detects a move, a capture and check', () => {
    expect(soundForChange(START, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', false)).toBe('move')
    const before = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const after = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'
    expect(soundForChange(before, after, false)).toBe('capture')
    expect(soundForChange(before, after, true)).toBe('check')
  })
  it('handles castling and stays silent on jumps or no change', () => {
    const pre = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
    expect(soundForChange(pre, 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1', false)).toBe('move')
    expect(soundForChange(START, START, false)).toBeNull()
    expect(soundForChange(START, '8/8/8/4k3/8/8/8/4K3 w - - 0 1', false)).toBeNull()
  })
})
