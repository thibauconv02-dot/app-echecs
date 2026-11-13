/**
 * Puzzle generation settings. Measured on 12 real games (Nov 2026):
 * a depth-10 scan finds 20 of the 21 blunders found at depth 16, ~30× faster;
 * candidates are then verified at depth 16.
 */

/** Fast first pass over every position of a game. */
export const SCAN_DEPTH = 10
/** A move becomes a candidate when it lost at least this much win% in the scan (margin for scan noise). */
export const CANDIDATE_MIN_LOSS = 10

/** Depth used to verify candidates and build the solution. */
export const VERIFY_DEPTH = 16
/** Keep a puzzle only if the best move beats the move played by at least this much win% (same position, same search depth). */
export const MIN_GAP = 20
/** "Punish" puzzle: the opponent's previous move lost at least this much win%. Otherwise the puzzle is "avoid the blunder". */
export const OPPONENT_BLUNDER_MIN_LOSS = 20
/** Skip positions that were decided anyway: still winning after the move played… */
export const MAX_PLAYED_WIN = 90
/** …or lost even with the best move. */
export const MIN_BEST_WIN = 10

/** Another move within this win% of the best one is accepted as a solution. */
export const ALT_TOLERANCE = 5
/** Up to this many of my moves per puzzle… */
export const MAX_MY_MOVES = 3
/** …continuing only while the best move is clearly the only good one (gap to the 2nd best, in win%). */
export const ONLY_MOVE_GAP = 15

/** Number of recent games processed by the "create puzzles" button. */
export const PUZZLE_BATCH_DEFAULT = 50
/** Maximum number of never-seen puzzles per session. */
export const NEW_PUZZLES_PER_SESSION = 15

/** Bump when the generation rules change, so games are scanned again. */
export const PUZZLE_VERSION = 1
