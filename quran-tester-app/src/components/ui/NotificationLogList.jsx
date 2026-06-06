import {
  entryPreview,
  recipientLine,
  statusLabel,
  typeIcon,
  typeLabel,
} from '../../lib/notificationLog.js'

function formatWhen(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ar-EG-u-nu-latn')
}

function EntryCard({ entry, onSelect, compact = false }) {
  const type = entry.notification_type
    || (entry.status === 'telegram_linked' ? 'telegram_linked' : null)

  return (
    <button
      type="button"
      className={`notification-log__item ${compact ? 'notification-log__item--compact' : ''}`}
      onClick={() => onSelect?.(entry)}
    >
      <div className="notification-log__meta">
        <span className="notification-log__type">
          <i className={`fa-solid ${typeIcon(type)}`} aria-hidden />
          <span className="notification-log__type-text">{typeLabel(type)}</span>
        </span>
        <span className={`notification-log__status notification-log__status--${entry.status}`}>
          {statusLabel(entry.status)}
        </span>
      </div>
      <time className="notification-log__when meta" dateTime={entry.created_at}>{formatWhen(entry.created_at)}</time>
      <p className="notification-log__recipients">{recipientLine(entry)}</p>
      <p className="notification-log__preview">{entryPreview(entry)}</p>
    </button>
  )
}

function BatchCard({ batch, onSelectBatch, onSelectEntry }) {
  const when = formatWhen(batch.created_at)
  return (
    <article className="notification-log__batch">
      <button
        type="button"
        className="notification-log__batch-head"
        onClick={() => onSelectBatch?.(batch)}
      >
        <div className="notification-log__meta notification-log__meta--batch">
          <span className="notification-log__type">
            <i className="fa-solid fa-calendar-week" aria-hidden />
            <span className="notification-log__type-text">ملخص حضور أسبوعي</span>
          </span>
          <span className="notification-log__batch-stats meta">
            <span>{batch.total.toLocaleString('ar-EG-u-nu-latn')} وليًا</span>
            <span>{batch.sent.toLocaleString('ar-EG-u-nu-latn')} مرسل</span>
            {batch.failed > 0 && (
              <em className="notification-log__batch-fail">{batch.failed.toLocaleString('ar-EG-u-nu-latn')} فشل</em>
            )}
          </span>
        </div>
        <time className="notification-log__when meta">{when}</time>
      </button>
      <ul className="notification-log__batch-list">
        {batch.items.slice(0, 3).map(item => (
          <li key={item.id}>
            <button type="button" className="notification-log__batch-row" onClick={() => onSelectEntry?.(item)}>
              <span>{item.student_name || '—'}</span>
              <span className={`notification-log__status notification-log__status--${item.status}`}>
                {statusLabel(item.status)}
              </span>
            </button>
          </li>
        ))}
        {batch.items.length > 3 && (
          <li className="meta notification-log__batch-more">
            +{(batch.items.length - 3).toLocaleString('ar-EG-u-nu-latn')} أخرى
          </li>
        )}
      </ul>
    </article>
  )
}

export default function NotificationLogList({
  items = [],
  entries = [],
  grouped = false,
  compact = false,
  onSelect,
  onSelectBatch,
  emptyTitle = 'لا رسائل',
  emptyMessage = 'لم تُرسل رسائل Telegram بعد.',
}) {
  if (grouped && items.length) {
    return (
      <div className="notification-log">
        {items.map(item => (
          item.kind === 'batch' ? (
            <BatchCard
              key={item.batchId}
              batch={item}
              onSelectBatch={onSelectBatch}
              onSelectEntry={onSelect}
            />
          ) : (
            <EntryCard key={item.entry.id} entry={item.entry} onSelect={onSelect} compact={compact} />
          )
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="notification-log__empty">
        <p className="notification-log__empty-title">{emptyTitle}</p>
        <p className="meta">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="notification-log">
      {entries.map(entry => (
        <EntryCard key={entry.id} entry={entry} onSelect={onSelect} compact={compact} />
      ))}
    </div>
  )
}
