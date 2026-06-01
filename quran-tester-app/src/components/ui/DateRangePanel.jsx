export default function DateRangePanel({
  from,
  to,
  onFromChange,
  onToChange,
  onCurrentWeek,
  search,
  onSearchChange,
  searchPlaceholder = 'بحث بالاسم أو الرقم',
  searchLabel = 'بحث',
  actions,
  footer,
}) {
  return (
    <section className="range-panel">
      <div className="range-panel__dates">
        <label className="range-panel__date">
          <span className="range-panel__date-label">من</span>
          <input className="input" type="date" value={from} onChange={e => onFromChange?.(e.target.value)} />
        </label>
        <span className="range-panel__sep" aria-hidden>—</span>
        <label className="range-panel__date">
          <span className="range-panel__date-label">إلى</span>
          <input className="input" type="date" value={to} onChange={e => onToChange?.(e.target.value)} />
        </label>
      </div>

      {onCurrentWeek && (
        <button type="button" className="btn btn--ghost btn--sm range-panel__week" onClick={onCurrentWeek}>
          <i className="fa-solid fa-calendar-week" aria-hidden />
          هذا الأسبوع
        </button>
      )}

      {search !== undefined && (
        <div className="students-search range-panel__search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input
            className="students-search__input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => onSearchChange?.(e.target.value)}
            aria-label={searchLabel}
          />
          {search && (
            <button type="button" className="students-search__clear" aria-label="مسح" onClick={() => onSearchChange?.('')}>
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
      )}

      {actions && <div className="range-panel__actions">{actions}</div>}
      {footer && <p className="range-panel__meta meta">{footer}</p>}
    </section>
  )
}
