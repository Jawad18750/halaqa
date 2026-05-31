import { useEffect, useMemo, useState } from 'react'
import { notifications } from '../../api'
import { confirmDialog } from './ConfirmDialog.jsx'
import { isTelegramActive, telegramStatus } from '../../lib/guardianUi.js'

export default function GuardianMessageSheet({
  open,
  guardians = [],
  title = 'رسالة Telegram',
  initialMessage = '',
  onClose,
  onSent,
  onToast,
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const linked = useMemo(() => guardians.filter(isTelegramActive), [guardians])
  const unlinked = useMemo(() => guardians.filter(g => !isTelegramActive(g)), [guardians])

  useEffect(() => {
    if (open) {
      setMessage(initialMessage || '')
      setError('')
    }
  }, [open, initialMessage])

  if (!open) return null

  async function handleSend(e) {
    e.preventDefault()
    if (!message.trim() || !linked.length) return
    const ok = await confirmDialog(
      'إرسال رسالة',
      `إرسال هذه الرسالة إلى ${linked.length} ولي عبر Telegram؟`
    )
    if (!ok) return
    setSending(true)
    setError('')
    try {
      const res = await notifications.sendToGuardians(message.trim(), linked.map(g => g.id))
      onToast?.(`تم الإرسال — ${res.stats?.sent ?? 0} نجح`)
      onSent?.(res)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="sheet-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-modal__backdrop" onClick={() => !sending && onClose?.()} />
      <div className="sheet-modal__panel guardian-message-sheet">
        <div className="sheet-modal__handle" aria-hidden />
        <h3 className="sheet-modal__title">{title}</h3>
        <p className="meta guardian-message-sheet__hint">
          تُرسل مباشرة عبر البوت — للأولياء المربوطين فقط.
        </p>

        <div className="guardian-message-sheet__recipients">
          {linked.map(g => (
            <span key={g.id} className="guardian-message-sheet__chip guardian-message-sheet__chip--ok">
              <i className="fa-brands fa-telegram" aria-hidden />
              {g.name}
            </span>
          ))}
          {unlinked.map(g => {
            const tg = telegramStatus(g)
            return (
              <span key={g.id} className="guardian-message-sheet__chip guardian-message-sheet__chip--muted" title={tg.label}>
                {g.name} ({tg.label})
              </span>
            )
          })}
        </div>

        {linked.length === 0 ? (
          <div className="guardian-message-sheet__empty">
            <p className="meta">لا يوجد أولياء مربوطون — أرسل دعوة Telegram أولاً.</p>
          </div>
        ) : (
          <form className="guardian-message-sheet__form" onSubmit={handleSend}>
            <label className="field">
              <span className="field__label">الرسالة</span>
              <textarea
                className="input guardian-message-sheet__textarea"
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="اكتب رسالتك المخصصة…"
                required
                autoFocus
              />
              <span className="field__hint">{message.length}/1000</span>
            </label>
            {error && <div className="alert alert--error">{error}</div>}
            <div className="sheet-modal__actions">
              <button type="submit" className="btn btn--primary" disabled={sending || !message.trim()}>
                {sending ? 'جاري الإرسال…' : `إرسال (${linked.length})`}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={sending}>
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
