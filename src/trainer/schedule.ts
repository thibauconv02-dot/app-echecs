import { INTERVAL_DAYS, NEW_LINES_PER_SESSION } from '../config/trainer'

export interface LineReview {
  lineId: string
  /** Leitner box, 1..INTERVAL_DAYS.length. */
  box: number
  /** Next review date (ms, local midnight). */
  due: number
  lastReviewed: number
  reviews: number
  lapses: number
}

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(dayStart: number, days: number): number {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + days) // calendar days, safe across DST changes
  return d.getTime()
}

/** New review state after playing a line (success = no error and no hint). */
export function schedule(prev: LineReview | undefined, lineId: string, success: boolean, now: number): LineReview {
  const box = success ? Math.min((prev?.box ?? 0) + 1, INTERVAL_DAYS.length) : 1
  return {
    lineId,
    box,
    due: addDays(startOfDay(now), INTERVAL_DAYS[box - 1]),
    lastReviewed: now,
    reviews: (prev?.reviews ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (success ? 0 : 1),
  }
}

export function isDue(review: LineReview | undefined, now: number): boolean {
  return review !== undefined && review.due <= now
}

export interface DeckCounts {
  total: number
  due: number
  fresh: number
  /** Lines in box ≥ 3 (interval of a week or more). */
  learned: number
}

export function deckCounts(lines: { id: string }[], reviews: Map<string, LineReview>, now: number): DeckCounts {
  let due = 0
  let fresh = 0
  let learned = 0
  for (const l of lines) {
    const r = reviews.get(l.id)
    if (!r) fresh++
    else {
      if (r.due <= now) due++
      if (r.box >= 3) learned++
    }
  }
  return { total: lines.length, due, fresh, learned }
}

/** Today's session: due lines (oldest first), then up to `newLimit` new lines in file order. */
export function buildSession<T extends { id: string }>(lines: T[], reviews: Map<string, LineReview>, now: number, newLimit = NEW_LINES_PER_SESSION): T[] {
  const due = lines.filter((l) => isDue(reviews.get(l.id), now)).sort((a, b) => reviews.get(a.id)!.due - reviews.get(b.id)!.due)
  const fresh = lines.filter((l) => !reviews.has(l.id)).slice(0, newLimit)
  return [...due, ...fresh]
}
