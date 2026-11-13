/** Step 2 settings: batch analysis, game phases, clock statistics. */

/** Default number of recent games analysed by the batch button. */
export const BATCH_DEFAULT_COUNT = 50

/** Opening = the first N full moves (N × 2 plies). */
export const OPENING_FULL_MOVES = 12

/** Endgame once pieces other than kings and pawns, both sides together, are ≤ this. */
export const ENDGAME_MAX_PIECES = 6

/** "Low clock" threshold in seconds (time left before playing the move). */
export const LOW_CLOCK_SECONDS = 60

/** A move is "fast" when it was played in less than this many seconds. */
export const FAST_MOVE_SECONDS = 5

/**
 * Opening families that Chess.com spreads over several names.
 * If the opening name contains `match`, the family is `family`. Checked in order.
 */
export const OPENING_FAMILY_OVERRIDES: { match: string; family: string }[] = [{ match: 'London', family: 'London System' }]

/** Words that close a family name ("Caro Kann Defense", "Englund Gambit", "Indian Game"…). */
export const OPENING_FAMILY_KEYWORDS = ['Defense', 'Defence', 'Opening', 'Attack', 'Game', 'Gambit', 'Countergambit', 'System']
