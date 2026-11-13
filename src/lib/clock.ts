export interface TimeControl {
  base: number // seconds
  increment: number // seconds
}

/** "600" → 10 min; "600+5" → 10 min + 5 s; daily ("1/86400") → null (no clock stats). */
export function parseTimeControl(tc: string): TimeControl | null {
  const m = /^(\d+)(?:\+(\d+(?:\.\d+)?))?$/.exec(tc)
  if (!m) return null
  return { base: Number(m[1]), increment: Number(m[2] ?? 0) }
}

/**
 * Clock before move `i` (0-based) for the player making it, and the time spent on it.
 * clocks[i] is the mover's remaining time *after* move i (as written by Chess.com, increment included).
 * Before = the same player's previous clock (i − 2), or the base time for their first move.
 * Spent = before − after + increment, never negative.
 */
export function moveTiming(clocks: (number | null)[], i: number, tc: TimeControl): { before: number; spent: number } | null {
  const after = clocks[i]
  const before = i >= 2 ? clocks[i - 2] : tc.base
  if (after === null || after === undefined || before === null || before === undefined) return null
  return { before, spent: Math.max(0, before - after + tc.increment) }
}
