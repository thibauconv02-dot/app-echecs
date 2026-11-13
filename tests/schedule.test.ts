import { describe, expect, it } from 'vitest'
import { buildSession, deckCounts, schedule, startOfDay, type LineReview } from '../src/trainer/schedule'
import type { RepLine } from '../src/repertoire/parse'

const NOW = new Date(2026, 10, 13, 15, 30).getTime() // 13 Nov 2026, 15:30 local
const day = (d: number) => new Date(2026, 10, 13 + d).getTime()

describe('schedule (Leitner)', () => {
  it('moves a new line to box 1, due tomorrow', () => {
    const r = schedule(undefined, 'L', true, NOW)
    expect(r).toMatchObject({ box: 1, due: day(1), reviews: 1, lapses: 0 })
  })
  it('climbs boxes on success with growing intervals, capped', () => {
    let r: LineReview | undefined
    const dues: number[] = []
    for (let i = 0; i < 8; i++) {
      r = schedule(r, 'L', true, NOW)
      dues.push((r.due - startOfDay(NOW)) / 86400000)
    }
    expect(dues.map(Math.round)).toEqual([1, 3, 7, 16, 35, 80, 80, 80])
    expect(r!.box).toBe(6)
  })
  it('goes back to box 1 on failure and counts the lapse', () => {
    const r = schedule({ lineId: 'L', box: 4, due: 0, lastReviewed: 0, reviews: 4, lapses: 0 }, 'L', false, NOW)
    expect(r).toMatchObject({ box: 1, due: day(1), reviews: 5, lapses: 1 })
  })
})

describe('buildSession', () => {
  const line = (id: string): RepLine => ({ id, fileId: 'f', opening: 'O', chapter: 'c', color: 'white', moves: [] })
  const lines = ['a', 'b', 'c', 'd', 'e'].map(line)
  const rev = (lineId: string, due: number, box = 1): LineReview => ({ lineId, box, due, lastReviewed: 0, reviews: 1, lapses: 0 })
  const reviews = new Map([
    ['a', rev('a', day(2))], // not due
    ['b', rev('b', day(0), 3)], // due today
    ['c', rev('c', day(-3))], // overdue
  ])

  it('puts due lines first (oldest first), then new lines up to the limit', () => {
    expect(buildSession(lines, reviews, NOW, 1).map((l) => l.id)).toEqual(['c', 'b', 'd'])
  })
  it('counts the deck', () => {
    expect(deckCounts(lines, reviews, NOW)).toEqual({ total: 5, due: 2, fresh: 2, learned: 1 })
  })
})
