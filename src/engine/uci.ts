/** Pure helpers for the UCI protocol (unit-tested without the engine). */

export interface EngineEval {
  depth: number
  /** Centipawns from the side to move's point of view (null when mate). */
  cp: number | null
  /** Moves to mate: >0 side to move mates, <0 side to move gets mated. */
  mate: number | null
  bestMove: string | null
  pv: string[]
}

export interface InfoLine {
  depth: number
  multipv: number
  cp: number | null
  mate: number | null
  pv: string[]
}

/** Parse an "info ... score ..." line; returns null for lines without a score (currmove, string…). */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ') || !line.includes(' score ')) return null
  const t = line.split(/\s+/)
  let depth = 0
  let multipv = 1
  let cp: number | null = null
  let mate: number | null = null
  let pv: string[] = []
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i])
        break
      case 'multipv':
        multipv = Number(t[++i])
        break
      case 'score':
        if (t[i + 1] === 'cp') cp = Number(t[i + 2])
        else if (t[i + 1] === 'mate') mate = Number(t[i + 2])
        i += 2
        // Skip "lowerbound"/"upperbound" markers.
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') i++
        break
      case 'pv':
        pv = t.slice(i + 1)
        i = t.length
        break
    }
  }
  return { depth, multipv, cp, mate, pv }
}

/** "bestmove e2e4 ponder e7e5" → "e2e4"; "bestmove (none)" → null. */
export function parseBestMove(line: string): string | null | undefined {
  if (!line.startsWith('bestmove')) return undefined
  const mv = line.split(/\s+/)[1]
  return !mv || mv === '(none)' ? null : mv
}
