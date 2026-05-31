import { useEffect, useMemo, useState } from 'react'
import { notifications } from '../../api'
import { confirmDialog } from './ConfirmDialog.jsx'
import { isTelegramActive, telegramStatus } from '../../lib/guardianUi.js'
import { appendSignatureFooter, hasHalaqaSettings } from '../../lib/messageContext.js'
import { useMessageSettings } from '../../lib/MessageSettingsContext.jsx'
import SheetModalFrame from './SheetModalFrame.jsx'

export default function GuardianMessageSheet({
  open,
  guardians = [],
  title = 'رسالة Telegram',
  initialMessage = '',
  reportOptions = null,
  onClose,
  onSent,
  onToast,
}) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [message, setMessage] = useState('')
  const [appendSignature, setAppendSignature] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const linked = useMemo(() => guardians.filter(isTelegramActive), [guardians])
  const unlinked = useMemo(() => guardians.filter(g => !isTelegramActive(g)), [guardians])
  const canAppendSignature = hasHalaqaSettings({ sheikhName, masjidName })

  useEffect(() => {
    if (open) {
      setMessage(initialMessage || '')
      setAppendSignature(canAppendSignature)
      setError('')
    }
  }, [open, initialMessage, canAppendSignature])

  if (!open) return null

  function composeOutgoingMessage() {
    const body = message.trim()
    if (!canAppendSignature || !appendSignature) return body
    return appendSignatureFooter(body, { sheikhName, masjidName })
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!message.trim() || !linked.length) return
    const outgoing = composeOutgoingMessage()
    const ok = await confirmDialog(
      'إرسال رسالة',
      `إرسال هذه الرسالة إلى ${linked.length} من أولياء الأمور المرتبطين عبر Telegram؟`
    )
    if (!ok) return
    setSending(true)
    setError('')
    try {
      const res = await notifications.sendToGuardians(outgoing, linked.map(g => g.id))
      const sent = res.stats?.sent ?? 0
      const failed = res.stats?.failed ?? 0
      if (sent === 0 && failed > 0) {
        onToast?.('تعذر إرسال الرسالة — تحقق من الربط')
      } else if (failed > 0) {
        onToast?.(`تم الإرسال إلى ${sent} — فشل ${failed}`)
      } else {
        onToast?.(`تم الإرسال إلى ${sent} من أولياء الأمور`)
      }
      onSent?.(res)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <SheetModalFrame
      open={open}
      ariaLabel={title}
      panelClassName="guardian-message-sheet"
      onBackdropClick={() => { if (!sending) onClose?.() }}
    >
      <div className="sheet-modal__handle" aria-hidden />
      <h3 className="sheet-modal__title">{title}</h3>
      <p className="meta guardian-message-sheet__hint">
        تُرسل مباشرة عبر البوت — لأولياء الأمور المرتبطين فقط ({linked.length}).
      </p>

      {reportOptions}

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
          <p className="meta">لا يوجد أولياء أمور مربوطون — أرسل دعوة Telegram أولاً.</p>
        </div>
      ) : (
        <form className="guardian-message-sheet__form" onSubmit={handleSend}>
          <label className="field">
            <span className="field__label">الرسالة</span>
            <textarea
              className="input guardian-message-sheet__textarea"
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 1000))}
              placeholder="اكتب رسالة خاصة لولي أمر الطالب…"
              required
              autoFocus
            />
            <span className="field__hint">{message.length}/1000</span>
          </label>
          {canAppendSignature && (
            <label className="message-signature-toggle">
              <input
                type="checkbox"
                checked={appendSignature}
                onChange={e => setAppendSignature(e.target.checked)}
              />
              <span>إضافة توقيع الحلقة في نهاية الرسالة</span>
            </label>
          )}
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
    </SheetModalFrame>
  )
}
