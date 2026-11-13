/**
 * Repertoire hook — implemented at step 2.
 * Step 2 will build a position-indexed tree (key = first 4 FEN fields) from repertoire/*.pgn
 * and return true when `uci` is a known continuation from `fenBefore`.
 * For now nothing is in the repertoire, so no move is ever labelled "Théorie".
 */
export interface RepertoireLookup {
  isTheory(fenBefore: string, uci: string, mover: 'white' | 'black'): boolean
}

export const emptyRepertoire: RepertoireLookup = {
  isTheory: () => false,
}
