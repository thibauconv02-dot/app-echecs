import { describe, expect, it } from 'vitest'
import { sanToFrench } from '../src/lib/notation'

describe('sanToFrench', () => {
  it('converts piece letters', () => {
    expect(sanToFrench('Nf3')).toBe('Cf3')
    expect(sanToFrench('Bxf6')).toBe('Fxf6')
    expect(sanToFrench('Qh5+')).toBe('Dh5+')
    expect(sanToFrench('Rab1')).toBe('Tab1')
    expect(sanToFrench('Kxe2#')).toBe('Rxe2#')
  })
  it('leaves pawn moves, castling and promotions consistent', () => {
    expect(sanToFrench('e4')).toBe('e4')
    expect(sanToFrench('gxf6')).toBe('gxf6')
    expect(sanToFrench('O-O-O')).toBe('O-O-O')
    expect(sanToFrench('exd8=Q+')).toBe('exd8=D+')
    expect(sanToFrench('b1=N')).toBe('b1=C')
  })
})
