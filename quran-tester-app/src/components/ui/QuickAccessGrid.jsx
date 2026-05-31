export default function QuickAccessGrid({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="quick-access" role="navigation" aria-label="وصول سريع">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={[
            'quick-access__card',
            `quick-access__card--${item.tone || 'default'}`,
            item.featured ? 'quick-access__card--featured' : '',
          ].filter(Boolean).join(' ')}
          onClick={item.onClick}
        >
          <span className="quick-access__main">
            <span className="quick-access__icon" aria-hidden>
              <i className={item.icon} />
            </span>
            <span className="quick-access__text">
              <strong>{item.label}</strong>
              {item.hint && (
                <span className="quick-access__hint">
                  {item.hint}
                  {item.badge != null && item.badge !== '' && (
                    <span className="quick-access__pill">{item.badge}</span>
                  )}
                </span>
              )}
            </span>
          </span>
          <i className="fa-solid fa-chevron-left quick-access__chevron" aria-hidden />
        </button>
      ))}
    </div>
  )
}
