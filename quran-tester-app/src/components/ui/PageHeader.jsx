export default function PageHeader({ title, subtitle, onBack, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {onBack && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom: 8, paddingInline: 0 }}>
            <i className="fa-solid fa-arrow-right" /> رجوع
          </button>
        )}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
