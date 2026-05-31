import { useState } from 'react'
import { guardians } from '../../api'
import {
  INVITE_CHANNELS,
  needsInvite,
  isTelegramActive,
  buildTelegramInviteMessage,
  openGuardianInvite,
  inviteChannelToast,
} from '../../lib/guardianUi.js'
import { useMessageSettings } from '../../lib/MessageSettingsContext.jsx'

export default function GuardianInvitePanel({
  guardians: guardianList = [],
  studentName,
  title = 'إرسال دعوة Telegram',
  hint = 'اختر طريقة الإرسال — ولي الأمر يضغط الرابط أو يرسل الرقم (6 أرقام) للبوت.',
  emptyMessage = 'لا يوجد أولياء — أضف ولي أمر أولاً.',
  onToast,
  onInviteFallback,
  compact = false,
}) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [sendingId, setSendingId] = useState(null)
  const pending = guardianList.filter(g => g && needsInvite(g))
  const linked = guardianList.filter(g => g && isTelegramActive(g))

  async function sendInvite(guardianRow, channel) {
    if (isTelegramActive(guardianRow)) {
      onToast?.('Telegram مربوط مسبقاً')
      return
    }
    setSendingId(guardianRow.id)
    try {
      const result = await guardians.createLinkCode(guardianRow.id)
      const inviteParams = {
        guardianName: guardianRow.name,
        studentName,
        deepLink: result.deepLink,
        code: result.code,
        sheikhName,
        masjidName,
      }
      const opened = openGuardianInvite(channel, {
        phoneE164: guardianRow.phone_e164,
        deepLink: result.deepLink,
        inviteParams,
      })
      if (opened.ok) {
        onToast?.(inviteChannelToast(channel))
      } else {
        onInviteFallback?.({
          guardian: guardianRow,
          message: buildTelegramInviteMessage(inviteParams),
          inviteParams,
          channel,
          ...result,
        })
      }
    } catch (e) {
      onToast?.(e.message || 'تعذر إنشاء الدعوة')
    } finally {
      setSendingId(null)
    }
  }

  if (!guardianList.length) {
    return (
      <div className="guardian-invite-panel guardian-invite-panel--empty">
        <p className="meta">{emptyMessage}</p>
      </div>
    )
  }

  if (!pending.length) {
    return (
      <div className="guardian-invite-panel guardian-invite-panel--done">
        <p className="guardian-invite-panel__done-msg">
          <i className="fa-solid fa-circle-check" aria-hidden />
          {linked.length
            ? 'جميع أولياء الأمور مربوطون — ستصل النتائج تلقائياً.'
            : 'لا يوجد أولياء بحاجة دعوة.'}
        </p>
      </div>
    )
  }

  return (
    <div className={`guardian-invite-panel ${compact ? 'guardian-invite-panel--compact' : ''}`}>
      {!compact && (
        <>
          <h3 className="guardian-invite-panel__title">{title}</h3>
          {hint && <p className="meta guardian-invite-panel__hint">{hint}</p>}
        </>
      )}
      <div className="guardian-invite-panel__list">
        {pending.map(g => (
          <div key={g.id} className="guardian-invite-panel__row">
            <div className="guardian-invite-panel__who">
              <strong>{g.name}</strong>
              {g.phone_e164 && <span className="meta" dir="ltr">{g.phone_e164}</span>}
            </div>
            <div className="guardian-card__invites">
              {Object.values(INVITE_CHANNELS).map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  className={`btn guardian-invite-channels__btn guardian-invite-channels__btn--${ch.id}`}
                  disabled={sendingId === g.id}
                  onClick={() => sendInvite(g, ch.id)}
                >
                  <i className={ch.icon} />
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
