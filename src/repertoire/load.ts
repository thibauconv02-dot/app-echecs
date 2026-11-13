import { parseRepertoireFile, RepertoireTree, type RepLine } from './parse'

// Bundled at build time from /repertoire/**/*.pgn (folders blancs/ and noirs/).
const files = import.meta.glob('/repertoire/**/*.pgn', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface LoadedRepertoire {
  lines: RepLine[]
  /** One tree per side, so a position never mixes white and black repertoires. */
  trees: Record<'white' | 'black', RepertoireTree>
}

let cache: LoadedRepertoire | null = null

export function loadRepertoire(): LoadedRepertoire {
  if (cache) return cache
  const lines = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, content]) => parseRepertoireFile({ path: path.replace(/^\/repertoire\//, ''), content }))
  cache = {
    lines,
    trees: {
      white: new RepertoireTree(lines.filter((l) => l.color === 'white')),
      black: new RepertoireTree(lines.filter((l) => l.color === 'black')),
    },
  }
  return cache
}
