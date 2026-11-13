import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../src/db/db'
import { archiveMonthEnd, importGames } from '../src/services/chesscom'
import fixture from './fixtures/chesscom-archive.json'

const BASE = 'https://api.chess.com/pub/player/anakinskywalker25/games'
const PAST = `${BASE}/2026/10`
const CURRENT = `${BASE}/2026/11`

function mockFetch(log: string[], inFlight = { n: 0, max: 0 }) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    log.push(url)
    inFlight.n++
    inFlight.max = Math.max(inFlight.max, inFlight.n)
    await new Promise((r) => setTimeout(r, 5))
    inFlight.n--
    const body = url.endsWith('/archives') ? { archives: [PAST, CURRENT] } : url === PAST ? fixture : { games: [] }
    return new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
}

describe('importGames', () => {
  let db: AppDB
  beforeEach(async () => {
    db = new AppDB(`test-${Math.random()}`)
  })

  it('imports in series, stores all time classes, caches past months', async () => {
    const now = () => Date.UTC(2026, 10, 12) // 12 Nov 2026
    const log: string[] = []
    const inFlight = { n: 0, max: 0 }
    const r1 = await importGames(db, 'anakinskywalker25', undefined, mockFetch(log, inFlight), now)
    expect(inFlight.max).toBe(1)
    expect(r1.newGames).toBe(3)
    const games = await db.games.toArray()
    expect(games.filter((g) => g.timeClass === 'rapid')).toHaveLength(2)
    const g = (await db.games.get(fixture.games[0].uuid))!
    expect(g.myColor).toBe('white')
    expect(g.outcome).toBe('loss')
    expect(g.eco).toBe('D02')
    expect(g.clocks[0]).toBeCloseTo(599.9)
    expect((await db.games.get(fixture.games[1].uuid))!.outcome).toBe('win')

    expect((await db.archives.get(PAST))!.complete).toBe(true)
    expect((await db.archives.get(CURRENT))!.complete).toBe(false)

    log.length = 0
    const r2 = await importGames(db, 'anakinskywalker25', undefined, mockFetch(log), now)
    expect(log).toEqual([`${BASE.replace('/games', '')}/games/archives`, CURRENT])
    expect(r2.newGames).toBe(0)
  })

  it('computes month end in UTC', () => {
    expect(archiveMonthEnd(`${BASE}/2026/12`)).toBe(Date.UTC(2027, 0, 1))
  })
})
