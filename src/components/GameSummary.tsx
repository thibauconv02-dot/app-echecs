import { CATEGORY_INFO } from '../config/classification'
import { summarize, type MoveCategory, type MoveClassification } from '../lib/classify'
import { MoveBadge } from './MoveBadge'

const ORDER: MoveCategory[] = ['best', 'good', 'mistake', 'blunder']

export function GameSummary({ moves, myColor, names }: { moves: MoveClassification[]; myColor: 'white' | 'black'; names: Record<'white' | 'black', string> }) {
  const sides: ('white' | 'black')[] = myColor === 'white' ? ['white', 'black'] : ['black', 'white']
  const s = Object.fromEntries(sides.map((c) => [c, summarize(moves, c)])) as Record<'white' | 'black', ReturnType<typeof summarize>>
  return (
    <table className="summary" data-testid="summary">
      <thead>
        <tr>
          <th />
          {sides.map((c) => (
            <th key={c} className={c === myColor ? 'me' : ''}>
              {c === myColor ? 'Moi' : names[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Précision</strong></td>
          {sides.map((c) => (
            <td key={c} className="accuracy">{s[c].accuracy === null ? '—' : `${s[c].accuracy!.toFixed(1)} %`}</td>
          ))}
        </tr>
        {ORDER.map((cat) => (
          <tr key={cat}>
            <td><MoveBadge category={cat} compact /> {CATEGORY_INFO[cat].label}</td>
            {sides.map((c) => (
              <td key={c}>{s[c].counts[cat]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
