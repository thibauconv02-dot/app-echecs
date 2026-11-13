import type { AppDB, ArchiveRecord, GameRecord, Outcome } from '../db/db'
import { parseChesscomPgn } from '../lib/pgnChesscom'

const API = 'https://api.chess.com/pub/player'
const DRAW_RESULTS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface ApiPlayer {
  username: string
  rating: number
  result: string
}
export interface ApiGame {
  uuid: string
  url: string
  pgn?: string
  time_class: string
  time_control: string
  end_time: number
  rated: boolean
  rules: string
  initial_setup?: string
  white: ApiPlayer
  black: ApiPlayer
}

export interface ImportProgress {
  done: number
  total: number
  current: string
  newGames: number
}

/** "…/games/2026/10" → first instant (ms, UTC) of the following month. */
export function archiveMonthEnd(url: string): number {
  const m = /\/(\d{4})\/(\d{2})$/.exec(url)
  if (!m) return Infinity
  return Date.UTC(Number(m[1]), Number(m[2]), 1) // month index = next month
}

export function outcomeFor(me: ApiPlayer, them: ApiPlayer): Outcome {
  if (me.result === 'win') return 'win'
  if (them.result === 'win') return 'loss'
  if (DRAW_RESULTS.has(me.result)) return 'draw'
  return 'loss'
}

/** Convert an API game into a stored record; null for variants or games without PGN. */
export function toGameRecord(game: ApiGame, username: string): GameRecord | null {
  if (game.rules !== 'chess' || !game.pgn) return null
  const me = username.toLowerCase()
  const myColor = game.white.username.toLowerCase() === me ? 'white' : game.black.username.toLowerCase() === me ? 'black' : null
  if (!myColor) return null
  let parsed
  try {
    parsed = parseChesscomPgn(game.pgn)
  } catch {
    return null // unreadable PGN: skip rather than fail the whole import
  }
  const [mine, theirs] = myColor === 'white' ? [game.white, game.black] : [game.black, game.white]
  const pick = (p: ApiPlayer) => ({ username: p.username, rating: p.rating, result: p.result })
  return {
    id: game.uuid,
    url: game.url,
    endTime: game.end_time,
    timeClass: game.time_class,
    timeControl: game.time_control,
    rated: game.rated,
    white: pick(game.white),
    black: pick(game.black),
    myColor,
    outcome: outcomeFor(mine, theirs),
    eco: parsed.eco,
    ecoUrl: parsed.ecoUrl,
    opening: parsed.opening,
    initialFen: game.initial_setup || START_FEN,
    sans: parsed.sans,
    clocks: parsed.clocks,
    pgn: game.pgn,
    analysedDepth: null,
  }
}

async function getJson<T>(url: string, fetchFn: typeof fetch): Promise<T> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Chess.com : ${res.status} sur ${url}`)
  return (await res.json()) as T
}

/**
 * Import all games of `username`. Requests are made strictly in series.
 * Past-month archives already fetched after the month ended are skipped (they never change).
 * All time classes are stored; the rapid filter is applied when listing.
 */
export async function importGames(
  db: AppDB,
  username: string,
  onProgress?: (p: ImportProgress) => void,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<{ newGames: number; archivesFetched: number }> {
  const { archives } = await getJson<{ archives: string[] }>(`${API}/${username}/games/archives`, fetchFn)
  let newGames = 0
  let archivesFetched = 0
  for (let i = 0; i < archives.length; i++) {
    const url = archives[i]
    onProgress?.({ done: i, total: archives.length, current: url.split('/games/')[1] ?? url, newGames })
    const cached = await db.archives.get(url)
    if (cached?.complete) continue

    const { games } = await getJson<{ games: ApiGame[] }>(url, fetchFn)
    archivesFetched++
    const records = games.map((g) => toGameRecord(g, username)).filter((g): g is GameRecord => g !== null)
    const existing = new Set((await db.games.bulkGet(records.map((r) => r.id))).filter(Boolean).map((g) => g!.id))
    const fresh = records.filter((r) => !existing.has(r.id))
    await db.games.bulkAdd(fresh)
    newGames += fresh.length

    const fetchedAt = now()
    const record: ArchiveRecord = { url, fetchedAt, complete: fetchedAt >= archiveMonthEnd(url), gameCount: games.length }
    await db.archives.put(record)
  }
  onProgress?.({ done: archives.length, total: archives.length, current: '', newGames })
  return { newGames, archivesFetched }
}
