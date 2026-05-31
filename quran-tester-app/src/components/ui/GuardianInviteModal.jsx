import {
  INVITE_CHANNELS,
  buildTelegramInviteMessage,
  getInviteUrl,
} from '../../lib/guardianUi.js'

export default function GuardianInviteModal({
  open,
  title,
  message,
  inviteParams,
  guardian,
  deepLink,
  onClose,
  onCopy,
}) {
  if (!open) return null

  const displayMessage = message || (inviteParams ? buildTelegramInviteMessage(inviteParams) : '')

  return (
    <div className="sheet-modal" role="dialog" aria-modal="true" aria-label={title || 'إرسال الدعوة'}>
      <div className="sheet-modal__backdrop" onClick={onClose} />
      <div className="sheet-modal__panel">
        <div className="sheet-modal__handle" aria-hidden />
        <h3 className="sheet-modal__title">{title || 'إرسال دعوة'}</h3>
        {guardian?.name && <p className="meta">{guardian.name}</p>}
        <p className="meta">تعذر فتح التطبيق. جرّب أحد الخيارات أو انسخ الرسالة.</p>
        <div className="guardian-link-box sheet-modal__message">{displayMessage}</div>
        <div className="guardian-card__invites sheet-modal__channels">
          {Object.values(INVITE_CHANNELS).map(ch => {
            const href = getInviteUrl(ch.id, {
              phoneE164: guardian?.phone_e164,
              deepLink,
              inviteParams,
            })
            if (!href) return null
            return (
              <a
                key={ch.id}
                className={`btn guardian-invite-channels__btn guardian-invite-channels__btn--${ch.id}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className={ch.icon} />
                <span>{ch.label}</span>
              </a>
            )
          })}
        </div>
        <div className="sheet-modal__actions">
          <button type="button" className="btn btn--ghost" onClick={() => onCopy?.(displayMessage)}>
            <i className="fa-solid fa-copy" /> نسخ الرسالة
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
