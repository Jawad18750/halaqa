export default function EmptyState({ icon = 'fa-inbox', title = 'لا بيانات', message, subtitle, action }) {
  return (
    <div className="empty">
      <div className="empty__icon"><i className={`fa-solid ${icon}`} /></div>
      <div className="empty__title">{title}</div>
      {(message || subtitle) && <p className="meta">{message || subtitle}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  )
}
