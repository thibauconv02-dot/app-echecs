/** Thin stacked bar (e.g. learned / in progress / new), with a hover title. */
export function ProgressBar({ segments }: { segments: { value: number; className: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const title = segments.map((s) => `${s.value} ${s.label}`).join(' · ')
  return (
    <div className="progress-bar" title={title}>
      {total > 0 &&
        segments.map((s) =>
          s.value > 0 ? <span key={s.className} className={s.className} style={{ flexGrow: s.value }} /> : null,
        )}
    </div>
  )
}
