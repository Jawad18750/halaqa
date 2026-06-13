export const NOTIFICATION_TYPE_LABELS = {
  session_result: 'نتيجة الاختبار',
  weekly_attendance: 'حضور أسبوعي',
  broadcast: 'رسالة يدوية',
  attendance_overview_report: 'تقرير لي',
  telegram_linked: 'ربط Telegram',
}

export const NOTIFICATION_TYPE_ICONS = {
  session_result: 'fa-clipboard-check',
  weekly_attendance: 'fa-calendar-week',
  broadcast: 'fa-paper-plane',
  attendance_overview_report: 'fa-chart-column',
  telegram_linked: 'fa-link',
}

export const NOTIFICATION_STATUS_LABELS = {
  sent: 'مرسلة',
  failed: 'فشلت',
  no_telegram_link: 'غير مرتبط',
  opt_out: 'إلغاء الاشتراك',
  skipped_no_recipient: 'بدون مستلم',
  telegram_linked: 'تم الربط',
}

export const TYPE_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'session_result', label: 'نتائج الاختبار' },
  { id: 'weekly_attendance', label: 'حضور أسبوعي' },
  { id: 'broadcast', label: 'رسالة يدوية' },
  { id: 'attendance_overview_report', label: 'تقرير لي' },
  { id: 'telegram_linked', label: 'ربط Telegram' },
]

export const STATUS_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'sent', label: 'مرسلة' },
  { id: 'failed', label: 'فشلت' },
  { id: 'no_telegram_link', label: 'غير مرتبط' },
  { id: 'opt_out', label: 'إلغاء الاشتراك' },
  { id: 'skipped_no_recipient', label: 'بدون مستلم' },
]

export function typeLabel(type) {
  return NOTIFICATION_TYPE_LABELS[type] || type || 'رسالة'
}

export function typeIcon(type) {
  return NOTIFICATION_TYPE_ICONS[type] || 'fa-envelope'
}

export function statusLabel(status) {
  return NOTIFICATION_STATUS_LABELS[status] || status || '—'
}

/** User-facing toast after manual session-result resend */
export function formatSessionNotifyResult(stats) {
  if (!stats) return 'تعذّر الإرسال'
  if (stats.skippedNoRecipient) return 'لا يوجد ولي أمر مرتبط بهذا الطالب'
  if (stats.sent > 0) {
    return stats.sent === 1
      ? 'تم إرسال النتيجة إلى ولي الأمر'
      : `تم إرسال النتيجة إلى ${stats.sent} من أولياء الأمور`
  }
  if (stats.optOut > 0) return 'ولي الأمر أوقف الإشعارات — اطلب منه إرسال /resume للبوت'
  if (stats.noLink > 0) return 'ولي الأمر غير مربوط على Telegram'
  if (stats.failed > 0) return 'تعذّر الإرسال — تحقق من الربط'
  return 'لم يتم الإرسال'
}

export function entryPreview(entry) {
  return entry?.message_preview || entry?.message_body || '—'
}

export function entryBody(entry) {
  return entry?.message_body || entry?.message_preview || '—'
}

export function recipientLine(entry) {
  if (entry?.recipient_label) return entry.recipient_label
  const parts = []
  if (entry?.guardian_name) parts.push(entry.guardian_name)
  if (entry?.student_name) parts.push(entry.student_name)
  return parts.length ? parts.join(' · ') : '—'
}

export function groupLogEntries(entries) {
  const batchMap = new Map()
  const standalone = []

  for (const entry of entries) {
    if (entry.batch_id && entry.notification_type === 'weekly_attendance') {
      const list = batchMap.get(entry.batch_id) || []
      list.push(entry)
      batchMap.set(entry.batch_id, list)
    } else {
      standalone.push({ kind: 'entry', entry, sortAt: entry.created_at })
    }
  }

  const batches = [...batchMap.entries()].map(([batchId, items]) => {
    const sent = items.filter(i => i.status === 'sent').length
    const failed = items.filter(i => i.status === 'failed').length
    const noLink = items.filter(i => i.status === 'no_telegram_link').length
    const sortAt = items.reduce((max, i) => (i.created_at > max ? i.created_at : max), items[0]?.created_at)
    return {
      kind: 'batch',
      batchId,
      items,
      sent,
      failed,
      noLink,
      total: items.length,
      sortAt,
      created_at: sortAt,
    }
  })

  return [...batches, ...standalone].sort((a, b) => {
    const aTime = new Date(a.sortAt || a.entry?.created_at || 0).getTime()
    const bTime = new Date(b.sortAt || b.entry?.created_at || 0).getTime()
    return bTime - aTime
  })
}
