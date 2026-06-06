import SheetModalFrame from './SheetModalFrame.jsx'
import {
  entryBody,
  recipientLine,
  statusLabel,
  typeLabel,
} from '../../lib/notificationLog.js'

function formatWhen(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ar-EG-u-nu-latn')
}

export default function NotificationLogDetailSheet({
  open,
  entry,
  batchItems = null,
  onClose,
  onOpenStudent,
  onOpenGuardians,
  onOpenAttendanceLog,
}) {
  if (!open || !entry) return null

  const type = entry.notification_type
    || (entry.status === 'telegram_linked' ? 'telegram_linked' : null)
  const showFix = ['failed', 'no_telegram_link'].includes(entry.status) && entry.guardian_id
  const showSession = entry.session_id && entry.student_id
  const showAttendance = entry.notification_type === 'weekly_attendance'

  return (
    <SheetModalFrame
      open={open}
      ariaLabel="كما وصلت الرسالة"
      panelClassName="notification-log-sheet"
      onBackdropClick={onClose}
    >
      <div className="sheet-modal__handle" aria-hidden />
      <header className="notification-log-sheet__head">
        <h3 className="sheet-modal__title">كما وصلت الرسالة</h3>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="إغلاق">
          <i className="fa-solid fa-xmark" />
        </button>
      </header>

      <div className="notification-log-sheet__scroll">
        <div className="notification-log-sheet__meta">
          <span className="notification-log__type">{typeLabel(type)}</span>
          <span className={`notification-log__status notification-log__status--${entry.status}`}>
            {statusLabel(entry.status)}
          </span>
          <time className="meta">{formatWhen(entry.created_at)}</time>
        </div>

        <p className="notification-log-sheet__recipient">
          <strong>المستلم:</strong> {recipientLine(entry)}
        </p>

        {entry.error_detail && (
          <div className="alert alert--error notification-log-sheet__error">
            {entry.error_detail}
          </div>
        )}

        <pre className="notification-log-sheet__body">{entryBody(entry)}</pre>

        {batchItems && batchItems.length > 1 && (
          <section className="notification-log-sheet__batch">
            <h4>رسائل هذه الدفعة ({batchItems.length.toLocaleString('ar-EG-u-nu-latn')})</h4>
            <ul>
              {batchItems.map(item => (
                <li key={item.id}>
                  <span className="notification-log-sheet__batch-name">{item.student_name || '—'}</span>
                  <span className={`notification-log__status notification-log__status--${item.status}`}>
                    {statusLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sheet-modal__actions notification-log-sheet__actions">
        {showSession && onOpenStudent && (
          <button type="button" className="btn btn--ghost" onClick={() => onOpenStudent(entry)}>
            <i className="fa-solid fa-user-graduate" /> ملف الطالب
          </button>
        )}
        {showAttendance && onOpenAttendanceLog && (
          <button type="button" className="btn btn--ghost" onClick={onOpenAttendanceLog}>
            <i className="fa-solid fa-clipboard-list" /> سجل الحضور
          </button>
        )}
        {showFix && onOpenGuardians && (
          <button type="button" className="btn btn--primary" onClick={onOpenGuardians}>
            <i className="fa-brands fa-telegram" /> إصلاح الربط
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose}>إغلاق</button>
      </div>
    </SheetModalFrame>
  )
}
