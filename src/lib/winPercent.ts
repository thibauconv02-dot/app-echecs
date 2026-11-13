import { WIN_COEFFICIENT } from '../config/classification'

export interface Score {
  cp: number | null
  mate: number | null
}

/**
 * Win percentage (0–100) for the side to move, using the Lichess formula:
 *   win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 * Mate for the side to move = 100; mate against (including mate 0, i.e. already mated) = 0.
 */
export function winPercent({ cp, mate }: Score): number {
  if (mate !== null) return mate > 0 ? 100 : 0
  const c = cp ?? 0
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_COEFFICIENT * c)) - 1)
}

/**
 * Loss of a move, in win% points from the mover's point of view.
 * `before` is the eval of the position before the move (mover to play);
 * `after` is the eval after the move (opponent to play), so it is flipped.
 * Never negative.
 */
export function moveLoss(before: Score, after: Score): { winBefore: number; winAfter: number; loss: number } {
  const winBefore = winPercent(before)
  const winAfter = 100 - winPercent(after)
  return { winBefore, winAfter, loss: Math.max(0, winBefore - winAfter) }
}
