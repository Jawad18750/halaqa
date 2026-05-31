export default function AnnouncementList({ items = [], onAction }) {
  if (!items.length) return null
  return (
    <div className="announce-list">
      {items.map(item => (
        <article key={item.id} className={`announce announce--${item.tone || 'default'}`}>
          <div className="announce__icon" aria-hidden>
            <i className={item.icon} />
          </div>
          <div className="announce__body">
            <h3 className="announce__title">{item.title}</h3>
            <p className="announce__text">{item.body}</p>
            {item.actionLabel && item.action && (
              <button type="button" className="btn btn--ghost btn--sm announce__action" onClick={() => onAction?.(item.action)}>
                {item.actionLabel}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
