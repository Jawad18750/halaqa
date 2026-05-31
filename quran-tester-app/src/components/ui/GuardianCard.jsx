import { useState } from 'react'
import { guardians } from '../../api'
import { confirmDialog } from './ConfirmDialog.jsx'
import GuardianInviteModal from './GuardianInviteModal.jsx'
import {
  INVITE_CHANNELS,
  telegramStatus,
  isTelegramActive,
  guardianInitials,
  guardianCardTitle,
  guardianCardSubtitle,
  isPlaceholderGuardianName,
  buildTelegramInviteMessage,
  openGuardianInvite,
  inviteChannelToast,
  copyText,
} from '../../lib/guardianUi.js'
import { useMessageSettings } from '../../lib/MessageSettingsContext.jsx'

function InviteButtons({ row, sending, onSend }) {
  return (
    <div className="guardian-card__invites" role="group" aria-label="إرسال دعوة">
      {Object.values(INVITE_CHANNELS).map(ch => (
        <button
          key={ch.id}
          type="button"
          className={`btn guardian-invite-channels__btn guardian-invite-channels__btn--${ch.id}`}
          onClick={() => onSend(row, ch.id)}
          disabled={sending === row.id}
          title={`إرسال عبر ${ch.label}`}
        >
          <i className={ch.icon} />
          <span>{ch.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function GuardianCard({
  row,
  variant = 'manage',
  student,
  expanded: expandedProp,
  onToggleExpand,
  onEdit,
  onDelete,
  onCopyPhone,
  onTogglePrimary,
  onToggleNotify,
  onRemoveLink,
  onOpenStudent,
  onToast,
  onRefresh,
  onSendMessage,
  selectMode = false,
  selected = false,
  onToggleSelect,
}) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [expandedLocal, setExpandedLocal] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [inviteFallback, setInviteFallback] = useState(null)

  const expanded = expandedProp !== undefined ? expandedProp : expandedLocal
  const toggleExpand = onToggleExpand || (() => setExpandedLocal(v => !v))

  const tg = telegramStatus(row)
  const linked = isTelegramActive(row)
  const students = row.students || []
  const studentCount = row.student_count || students.length || 0
  const showStudents = variant === 'manage' && students.length > 0
  const displayTitle = guardianCardTitle(row, students)
  const displaySubtitle = guardianCardSubtitle(row, students)
  const placeholderName = isPlaceholderGuardianName(row.name)
  const previewStudents = showStudents ? students.slice(0, 4) : []
  const hiddenStudentCount = Math.max(0, students.length - previewStudents.length)

  async function sendInvite(guardianRow, channel) {
    if (linked) {
      onToast?.('Telegram مربوط مسبقاً')
      return
    }

    setSendingId(guardianRow.id)
    try {
      const result = await guardians.createLinkCode(guardianRow.id)
      const inviteParams = {
        guardianName: guardianRow.name,
        studentName: student?.name,
        deepLink: result.deepLink,
        code: result.code,
        sheikhName,
        masjidName,
      }
      const message = buildTelegramInviteMessage(inviteParams)
      const opened = openGuardianInvite(channel, {
        phoneE164: guardianRow.phone_e164,
        deepLink: result.deepLink,
        inviteParams,
      })

      if (opened.ok) {
        onToast?.(inviteChannelToast(channel))
      } else {
        setInviteFallback({ guardian: guardianRow, message, inviteParams, channel, ...result })
      }
    } catch (e) {
      onToast?.(e.message)
    } finally {
      setSendingId(null)
    }
  }

  async function handleCopyPhone() {
    if (onCopyPhone) {
      onCopyPhone(row)
      return
    }
    const ok = await copyText(row.phone_e164)
    onToast?.(ok ? 'تم نسخ الرقم' : 'تعذر النسخ')
  }

  async function handleDelete() {
    const ok = await confirmDialog('حذف ولي الأمر', `حذف ${row.name} وجميع الروابط؟`)
    if (!ok) return
    try {
      await guardians.remove(row.id)
      onToast?.('تم الحذف')
      onRefresh?.()
      onDelete?.(row)
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function handleRemoveLink() {
    const ok = await confirmDialog('حذف الربط', `إزالة ${row.name} من هذا الطالب؟`)
    if (!ok) return
    try {
      await guardians.removeLink(row.link_id)
      onToast?.('تم الحذف')
      onRefresh?.()
      onRemoveLink?.(row)
    } catch (e) {
      onToast?.(e.message)
    }
  }

  return (
    <li className={`guardian-card guardian-card--${variant} ${linked ? 'guardian-card--linked' : 'guardian-card--needs-invite'} ${selectMode && selected ? 'guardian-card--selected' : ''}`}>
      <div className="guardian-card__header">
        {selectMode && (
          <label className="guardian-card__select">
            <input
              type="checkbox"
              checked={selected}
              disabled={!linked}
              onChange={onToggleSelect}
              aria-label={`اختيار ${row.name}`}
            />
          </label>
        )}
        <div className="guardian-card__identity">
          <span className="guardian-card__avatar" aria-hidden title={displayTitle}>
            {guardianInitials(placeholderName ? displayTitle : row.name)}
          </span>
          <div className="guardian-card__info">
            <div className="guardian-card__name">
              {row.is_primary && (
                <span className="guardian-primary" title="ولي أساسي">
                  <i className="fa-solid fa-star" />
                </span>
              )}
              <strong>{displayTitle}</strong>
              {row.relationship && variant === 'profile' && (
                <span className="meta"> ({row.relationship})</span>
              )}
            </div>
            {displaySubtitle && variant === 'manage' && (
              <p className="guardian-card__students-preview meta">{displaySubtitle}</p>
            )}
            <button type="button" className="guardian-card__phone" onClick={handleCopyPhone} title="نسخ الرقم">
              <span dir="ltr">{row.phone_e164}</span>
              <i className="fa-regular fa-copy" aria-hidden />
            </button>
          </div>
        </div>

        <div className="guardian-card__actions">
          {variant === 'profile' && (
            <>
              {!row.is_primary && onTogglePrimary && (
                <button type="button" className="btn btn--ghost btn--icon" onClick={() => onTogglePrimary(row)} title="تعيين أساسي">
                  <i className="fa-regular fa-star" />
                </button>
              )}
              {onToggleNotify && (
                <button
                  type="button"
                  className={`btn btn--ghost btn--icon ${row.notify_on_result ? 'guardian-notify--on' : ''}`}
                  onClick={() => onToggleNotify(row)}
                  title="إشعار بالنتائج"
                >
                  <i className="fa-solid fa-bell" />
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--icon" onClick={handleRemoveLink} title="حذف الربط">
                <i className="fa-solid fa-trash" />
              </button>
            </>
          )}
          {variant === 'manage' && (
            <>
              {onEdit && (
                <button type="button" className="btn btn--ghost btn--icon" onClick={() => onEdit(row)} title="تعديل">
                  <i className="fa-solid fa-pen" />
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--icon guardian-card__delete" onClick={handleDelete} title="حذف">
                <i className="fa-solid fa-trash" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="guardian-card__meta-row">
        <span className={`guardian-badge ${tg.className}`}>{tg.label}</span>
        {variant === 'manage' && studentCount > 0 && (
          <button
            type="button"
            className={`guardian-card__students-toggle ${expanded ? 'guardian-card__students-toggle--open' : ''}`}
            onClick={showStudents && students.length > 4 ? toggleExpand : undefined}
            aria-expanded={showStudents && students.length > 4 ? expanded : undefined}
            disabled={!showStudents || students.length <= 4}
          >
            <i className="fa-solid fa-user-group" aria-hidden />
            {studentCount} {studentCount === 1 ? 'طالب' : 'طلاب'}
            {showStudents && students.length > 4 && (
              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} aria-hidden />
            )}
          </button>
        )}
      </div>

      {variant === 'manage' && previewStudents.length > 0 && (
        <div className="guardian-card__students guardian-card__students--preview">
          {previewStudents.map(s => (
            <button
              key={s.id}
              type="button"
              className="guardian-card__student-chip"
              onClick={() => onOpenStudent?.({ id: s.id, number: s.number, name: s.name })}
            >
              <span className="guardian-card__student-num">{s.number}</span>
              {s.name}
            </button>
          ))}
          {hiddenStudentCount > 0 && (
            <button
              type="button"
              className="guardian-card__student-chip guardian-card__student-chip--more"
              onClick={toggleExpand}
            >
              +{hiddenStudentCount}
            </button>
          )}
        </div>
      )}

      {linked ? (
        <div className="guardian-card__linked-wrap">
          <p className="guardian-card__linked-note">
            <i className="fa-brands fa-telegram" aria-hidden />
            مربوط — ستصل النتائج تلقائياً
          </p>
          {onSendMessage && (
            <button type="button" className="btn btn--ghost btn--sm guardian-card__message-btn" onClick={() => onSendMessage(row)}>
              <i className="fa-solid fa-paper-plane" /> رسالة مخصصة
            </button>
          )}
        </div>
      ) : (
        <div className="guardian-card__invites-wrap">
          <p className="guardian-card__invites-label">إرسال دعوة</p>
          <InviteButtons row={row} sending={sendingId} onSend={sendInvite} />
        </div>
      )}

      {showStudents && expanded && students.length > 4 && (
        <div className="guardian-card__students guardian-card__students--expanded">
          {students.slice(4).map(s => (
            <button
              key={s.id}
              type="button"
              className="guardian-card__student-chip"
              onClick={() => onOpenStudent?.({ id: s.id, number: s.number, name: s.name })}
            >
              <span className="guardian-card__student-num">{s.number}</span>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <GuardianInviteModal
        open={!!inviteFallback}
        title={`إرسال دعوة — ${inviteFallback?.guardian?.name || ''}`}
        message={inviteFallback?.message}
        inviteParams={inviteFallback?.inviteParams}
        guardian={inviteFallback?.guardian}
        deepLink={inviteFallback?.deepLink}
        onClose={() => setInviteFallback(null)}
        onCopy={async (text) => {
          const ok = await copyText(text)
          onToast?.(ok ? 'تم نسخ الرسالة' : 'تعذر النسخ')
        }}
      />
    </li>
  )
}
