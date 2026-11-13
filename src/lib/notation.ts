/**
 * Display-only conversion of English SAN (as produced by chess.js) to French notation.
 * Internal data and files always keep English SAN.
 * K→R (Roi), Q→D (Dame), R→T (Tour), B→F (Fou), N→C (Cavalier); pawns have no letter.
 */
const PIECE_FR: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' }

export function sanToFrench(san: string): string {
  // Only uppercase piece letters are converted; files (a–h) are lowercase and untouched.
  // Castling "O-O" uses the letter O, which is not in the map.
  return san.replace(/[KQRBN]/g, (letter) => PIECE_FR[letter])
}
