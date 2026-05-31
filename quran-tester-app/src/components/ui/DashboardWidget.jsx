export default function DashboardWidget({
  title,
  icon,
  badge,
  actions,
  variant = 'default',
  className = '',
  children,
}) {
  return (
    <section className={`dash-widget dash-widget--${variant} ${className}`.trim()}>
      <header className="dash-widget__head">
        <div className="dash-widget__title-wrap">
          {icon && (
            <span className="dash-widget__icon" aria-hidden="true">
              <i className={`fa-solid ${icon}`} />
            </span>
          )}
          <h2 className="dash-widget__title">{title}</h2>
          {badge != null && badge !== '' && (
            <span className="dash-widget__badge">{badge}</span>
          )}
        </div>
        {actions && <div className="dash-widget__actions">{actions}</div>}
      </header>
      <div className="dash-widget__body">{children}</div>
    </section>
  )
}
