export default function StatTile({ label, value, icon, tone = 'default' }) {
  return (
    <div className={`stat ${tone !== 'default' ? `stat--${tone}` : ''}`}>
      {icon && <i className={`stat__icon ${icon}`} aria-hidden />}
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value ?? '—'}</div>
    </div>
  )
}
