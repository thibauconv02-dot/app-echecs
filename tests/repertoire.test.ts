import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { parseRepertoireFile, RepertoireTree, type RepLine } from '../src/repertoire/parse'

const read = (path: string): RepLine[] =>
  parseRepertoireFile({ path, content: readFileSync(join(__dirname, '..', 'repertoire', path), 'utf8') })

const tromp = read('blancs/trompowsky.pgn')
const caro = read('noirs/caro-kann.pgn')
const rago = read('noirs/ragozine.pgn')

describe('repertoire files', () => {
  it('have the expected number of lines', () => {
    expect(tromp).toHaveLength(16)
    expect(caro).toHaveLength(9)
    expect(rago).toHaveLength(8)
  })

  it('take the side from the folder / Orientation tag and name the opening', () => {
    expect(tromp.every((l) => l.color === 'white' && l.opening === 'Trompowsky')).toBe(true)
    expect(caro.every((l) => l.color === 'black' && l.opening === 'Caro-Kann')).toBe(true)
    expect(rago[0].chapter).toBe('Gambit Dame – Ragozine (4...Bb4)')
  })

  it('end every line on my move', () => {
    for (const l of [...tromp, ...caro, ...rago]) {
      const lastIsMine = (l.moves.length - 1) % 2 === (l.color === 'white' ? 0 : 1)
      expect(lastIsMine).toBe(true)
    }
    // "4... e5 5. e3" style endings are kept; a line ending on an opponent move is trimmed.
    expect(caro.some((l) => l.moves.at(-1)!.san === 'O-O')).toBe(true)
  })

  it('keep $1 / $2 annotations', () => {
    const bxd = caro.find((l) => l.moves.some((m) => m.san === 'Qxd4'))!
    expect(bxd.moves.find((m) => m.san === 'Qxd4')!.annotation).toBe('!')
    const b5 = tromp.flatMap((l) => l.moves).find((m) => m.san === 'b5' && m.annotation === '?')
    expect(b5).toBeDefined()
  })

  it('have exactly one expected move per position for my side', () => {
    for (const lines of [tromp, caro, rago]) {
      const tree = new RepertoireTree(lines)
      const color = lines[0].color === 'white' ? 'w' : 'b'
      for (const [key, node] of tree.nodes) {
        if (key.split(' ')[1] === color) expect([key, node.moves.size]).toEqual([key, 1])
      }
    }
  })

  it('merge the Caro-Kann transposition into one node', () => {
    const tree = new RepertoireTree(caro)
    const play = (sans: string[]) => {
      const c = new Chess()
      sans.forEach((s) => c.move(s))
      return c.fen()
    }
    const start = ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6']
    const a = play([...start, 'Nf3', 'Nd7', 'h4', 'h6', 'h5', 'Bh7'])
    const b = play([...start, 'h4', 'h6', 'Nf3', 'Nd7', 'h5', 'Bh7'])
    expect(tree.movesFrom(a).map((m) => m.san)).toEqual(['Bd3'])
    expect(tree.movesFrom(a)).toEqual(tree.movesFrom(b))
    // After 9.Bd3, my move is known whatever the order of arrival.
    const c = new Chess(a)
    c.move('Bd3')
    expect(tree.movesFrom(c.fen()).map((m) => m.san)).toEqual(['Bxd3'])
  })
})
