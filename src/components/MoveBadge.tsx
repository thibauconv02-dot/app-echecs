import { CATEGORY_INFO } from '../config/classification'
import type { MoveCategory } from '../lib/classify'

export function MoveBadge({ category, compact = false }: { category: MoveCategory; compact?: boolean }) {
  const info = CATEGORY_INFO[category]
  return (
    <span className={`badge ${compact ? 'compact' : ''}`} style={{ backgroundColor: info.color }} title={info.label}>
      {compact ? '' : info.label}
    </span>
  )
}
