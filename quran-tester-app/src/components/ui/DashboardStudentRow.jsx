export default function DashboardStudentRow({
  id,
  numberLabel,
  name,
  meta,
  rank,
  rankTone,
  onOpen,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen?.(id)
    }
  }

  return (
    <div
      className={`dash-row clickable-row ${rankTone ? `dash-row--rank-${rankTone}` : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(id)}
      onKeyDown={handleKeyDown}
    >
      <div className="dash-row__lead">
        {rank != null ? (
          <span className={`dash-row__rank dash-row__rank--${rankTone || 'default'}`} aria-label={`المرتبة ${rank}`}>
            {rank}
          </span>
        ) : (
          <span className="dash-row__num">{numberLabel}</span>
        )}
      </div>
      <div className="dash-row__main">
        <span className="dash-row__name">{name}</span>
        {meta && <span className="dash-row__meta">{meta}</span>}
      </div>
      <span className="dash-row__chev" aria-hidden="true">
        <i className="fa-solid fa-chevron-left" />
      </span>
    </div>
  )
}
