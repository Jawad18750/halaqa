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
  telegramNotificationStatusLabel,
  formatTelegramLinkedAt,
  formatTelegramAccountLabel,
  buildInviteMessageForChannel,
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
  onToggleWeeklyAttendance,
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
  const linked = row?.telegram_linked
  const telegramActive = isTelegramActive(row)
  const students = row.students || []
  const studentCount = row.student_count || students.length || 0
  const showStudents = variant === 'manage' && students.length > 0
  const displayTitle = guardianCardTitle(row, students)
  const displaySubtitle = guardianCardSubtitle(row, students)
  const placeholderName = isPlaceholderGuardianName(row.name)
  const isExpanded = expanded
  const canExpand = variant === 'manage' || variant === 'profile'
  const profileStatusLine = [
    tg.label,
    row.notify_on_result ? 'نتائج' : '',
    row.notify_weekly_attendance ? 'حضور' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  async function sendInvite(guardianRow, channel) {
    if (linked) {
      onToast?.('Telegram مربوط مسبقاً')
      return
    }

    const resolvedStudentName = student?.name || students[0]?.name
    setSendingId(guardianRow.id)
    try {
      const result = await guardians.createLinkCode(guardianRow.id)
      const inviteParams = {
        guardianName: guardianRow.name,
        studentName: resolvedStudentName,
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

      if (opened.error) {
        onToast?.(opened.error)
        return
      }
      if (opened.ok) {
        onToast?.(inviteChannelToast(channel))
      } else {
        let message
        try {
          message = buildInviteMessageForChannel(channel, inviteParams)
        } catch (err) {
          onToast?.(err.message)
          return
        }
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
    const ok = await confirmDialog(
      'إزالة ولي الأمر',
      'سيتم إزالة ولي الأمر من هذا الطالب. إذا لم يكن مرتبطاً بأي طالب آخر، سيُحذف رقمه بالكامل ويمكنك إضافته من جديد.'
    )
    if (!ok) return
    try {
      const result = await guardians.removeLink(row.link_id)
      onToast?.(result?.guardianDeleted ? 'تمت الإزالة وحُذف رقم ولي الأمر' : 'تمت الإزالة من هذا الطالب')
      onRefresh?.()
      onRemoveLink?.(row)
    } catch (e) {
      onToast?.(e.message)
    }
  }

  async function handleRevokeTelegram() {
    const ok = await confirmDialog(
      'إلغاء ربط Telegram',
      'سيؤدي إلغاء الربط إلى توقف وصول نتائج جميع الطلاب المرتبطين بولي الأمر عبر Telegram، وسيحتاج ولي الأمر إلى رابط جديد لإعادة الربط. هل تريد المتابعة؟',
      { confirmLabel: 'إلغاء الربط', cancelLabel: 'تراجع' }
    )
    if (!ok) return
    try {
      await guardians.revokeTelegram(row.id)
      onToast?.('تم إلغاء ربط Telegram بنجاح.')
      onRefresh?.()
    } catch {
      onToast?.('تعذّر إلغاء الربط حاليًا، يرجى المحاولة مرة أخرى.')
    }
  }

  return (
    <li
      className={[
        'guardian-card',
        `guardian-card--${variant}`,
        linked ? 'guardian-card--linked' : 'guardian-card--needs-invite',
        isExpanded ? 'guardian-card--expanded' : '',
        selectMode && selected ? 'guardian-card--selected' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="guardian-card__header">
        {selectMode && (
          <label className="guardian-card__select">
            <input
              type="checkbox"
              checked={selected}
              disabled={!telegramActive}
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
            </div>
            {displaySubtitle && variant === 'manage' && (
              <p className="guardian-card__notes meta">{displaySubtitle}</p>
            )}
            {variant === 'profile' ? (
              <>
                <button type="button" className="guardian-card__phone guardian-card__phone--row" onClick={handleCopyPhone} title="نسخ الرقم">
                  <span dir="ltr">{row.phone_e164}</span>
                  <i className="fa-regular fa-copy" aria-hidden />
                </button>
                {!isExpanded && profileStatusLine && (
                  <p className="guardian-card__status meta">{profileStatusLine}</p>
                )}
              </>
            ) : (
              <button type="button" className="guardian-card__phone" onClick={handleCopyPhone} title="نسخ الرقم">
                <span dir="ltr">{row.phone_e164}</span>
                <i className="fa-regular fa-copy" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="guardian-card__actions">
          {variant === 'profile' && (
            <button
              type="button"
              className="btn btn--ghost btn--icon guardian-card__expand"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'إخفاء الإعدادات' : 'إعدادات ولي الأمر'}
            >
              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} aria-hidden />
            </button>
          )}
          {variant === 'manage' && (
            <>
              {canExpand && (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon guardian-card__expand"
                  onClick={toggleExpand}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                >
                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} aria-hidden />
                </button>
              )}
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

      {variant === 'manage' && (
        <div className="guardian-card__meta-row">
          <span className={`guardian-badge ${tg.className}`}>{tg.label}</span>
          {studentCount > 0 && (
            <button
              type="button"
              className={`guardian-card__students-toggle ${isExpanded ? 'guardian-card__students-toggle--open' : ''}`}
              onClick={toggleExpand}
              aria-expanded={isExpanded}
            >
              <i className="fa-solid fa-user-group" aria-hidden />
              {studentCount} {studentCount === 1 ? 'طالب' : 'طلاب'}
            </button>
          )}
        </div>
      )}

      {variant === 'profile' && isExpanded && (
        <div className="guardian-card__profile-body">
          <div className="guardian-card__profile-toggles" role="group" aria-label="إعدادات ولي الأمر">
            {!row.is_primary && onTogglePrimary && (
              <button type="button" className="guardian-profile-toggle" onClick={() => onTogglePrimary(row)} title="تعيين ولي أساسي">
                <i className="fa-regular fa-star" aria-hidden />
              </button>
            )}
            {onToggleNotify && (
              <button
                type="button"
                className={`guardian-profile-toggle ${row.notify_on_result ? 'guardian-profile-toggle--on' : ''}`}
                onClick={() => onToggleNotify(row)}
                aria-pressed={row.notify_on_result}
                title="إشعار بالنتائج"
              >
                <i className="fa-solid fa-bell" aria-hidden />
              </button>
            )}
            {onToggleWeeklyAttendance && (
              <button
                type="button"
                className={`guardian-profile-toggle ${row.notify_weekly_attendance ? 'guardian-profile-toggle--on' : ''}`}
                onClick={() => onToggleWeeklyAttendance(row)}
                aria-pressed={row.notify_weekly_attendance}
                title="ملخص حضور أسبوعي"
              >
                <i className="fa-solid fa-calendar-check" aria-hidden />
              </button>
            )}
          </div>

          {linked ? (
            <div className="guardian-card__profile-actions">
              {telegramActive && onSendMessage && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSendMessage(row)}>
                  <i className="fa-solid fa-paper-plane" aria-hidden /> رسالة
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleRevokeTelegram}>
                <i className="fa-solid fa-link-slash" aria-hidden /> فك الربط
              </button>
            </div>
          ) : (
            <InviteButtons row={row} sending={sendingId} onSend={sendInvite} />
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm guardian-card__remove-student"
            onClick={handleRemoveLink}
          >
            <i className="fa-solid fa-user-minus" aria-hidden /> إزالة من الطالب
          </button>
        </div>
      )}

      {variant === 'manage' && isExpanded && showStudents && (
        <div className="guardian-card__students guardian-card__students--expanded">
          {students.map(s => (
            <button
              key={s.id}
              type="button"
              className="guardian-card__student-chip"
              onClick={() => onOpenStudent?.({ id: s.id, number: s.number, name: s.name })}
            >
              <span className="guardian-card__student-num">{s.number}</span>
              <span className="guardian-card__student-name">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {variant === 'manage' && isExpanded && linked && (
        <div className="guardian-card__linked-wrap">
          <p className="guardian-card__linked-line meta">
            <i className="fa-brands fa-telegram" aria-hidden />
            <span>{formatTelegramAccountLabel(row)}</span>
            <span className="guardian-card__linked-dot" aria-hidden>·</span>
            <span>{telegramNotificationStatusLabel(row)}</span>
            {formatTelegramLinkedAt(row.telegram_linked_at) && (
              <>
                <span className="guardian-card__linked-dot" aria-hidden>·</span>
                <span>{formatTelegramLinkedAt(row.telegram_linked_at)}</span>
              </>
            )}
          </p>
          <div className="guardian-card__linked-actions">
            {telegramActive && onSendMessage && (
              <button type="button" className="btn btn--ghost btn--sm guardian-card__message-btn" onClick={() => onSendMessage(row)}>
                <i className="fa-solid fa-paper-plane" /> رسالة
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm guardian-card__revoke-btn" onClick={handleRevokeTelegram} title="إلغاء ربط Telegram">
              <i className="fa-solid fa-link-slash" /> إلغاء الربط
            </button>
          </div>
        </div>
      )}

      {variant === 'manage' && isExpanded && !linked && (
        <div className="guardian-card__invites-wrap">
          <InviteButtons row={row} sending={sendingId} onSend={sendInvite} />
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
