/** Opening trainer settings. */

/**
 * Spaced repetition (Leitner boxes): after a line is played without error it moves up one box,
 * and comes back after the interval of its new box. Any error sends it back to box 1.
 * INTERVAL_DAYS[box - 1] = days before the next review.
 */
export const INTERVAL_DAYS = [1, 3, 7, 16, 35, 80]

/** Maximum number of never-seen lines introduced in one session. */
export const NEW_LINES_PER_SESSION = 10

/** Delay before the app plays the opponent's move (ms). */
export const OPPONENT_MOVE_DELAY_MS = 450
