export default function AnnouncementList({ items = [], onAction }) {
  if (!items.length) return null
  return (
    <div className="announce-list">
      {items.map(item => (
        <article key={item.id} className={`announce announce--${item.tone || 'default'}`}>
          <div className="announce__head">
            <span className="announce__icon" aria-hidden>
              <i className={item.icon} />
            </span>
            <h3 className="announce__title">{item.title}</h3>
          </div>
          <p className="announce__text">{item.body}</p>
          {item.actionLabel && item.action && (
            <div className="announce__footer">
              <button
                type="button"
                className="btn btn--ghost btn--sm announce__action"
                onClick={() => onAction?.(item.action)}
              >
                {item.actionLabel}
                <i className="fa-solid fa-arrow-left" aria-hidden />
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
