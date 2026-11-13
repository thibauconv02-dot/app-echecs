import { ENDGAME_MAX_PIECES, OPENING_FULL_MOVES } from '../config/stats'

export type Phase = 'opening' | 'middlegame' | 'endgame'

export const PHASE_LABELS: Record<Phase, string> = {
  opening: 'Ouverture',
  middlegame: 'Milieu',
  endgame: 'Finale',
}

/** Pieces other than kings and pawns, both colours, from the board part of a FEN. */
export function countPieces(fen: string): number {
  return (fen.split(' ')[0].match(/[qrbnQRBN]/g) ?? []).length
}

/**
 * Phase of a move, from the position before it.
 * Opening = first OPENING_FULL_MOVES moves; then endgame when few pieces remain; otherwise middlegame.
 */
export function phaseOf(fenBefore: string, ply: number): Phase {
  if (ply <= OPENING_FULL_MOVES * 2) return 'opening'
  return countPieces(fenBefore) <= ENDGAME_MAX_PIECES ? 'endgame' : 'middlegame'
}
