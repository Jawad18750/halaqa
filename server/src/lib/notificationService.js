import { randomUUID } from 'crypto'
import { pool } from './db.js'
import { sendMessage, shouldRetry, isTelegramConfigured } from './telegramBot.js'
import { buildSessionResultMessage } from './sessionMessage.js'
import { getUserSettings } from './userSettings.js'
import {
  buildAttendanceOverview,
  buildAttendanceOverviewReportMessage,
  buildWeeklyAttendanceGuardianMessage,
} from './attendanceService.js'
import { normalizePhoneE164, phonesEquivalent } from './phone.js'

const RETRY_DELAY_MS = 2000
const PREVIEW_MAX = 120

function messagePreviewFromBody(body) {
  return String(body || '').slice(0, PREVIEW_MAX)
}

async function logNotification(row) {
  const body = row.messageBody ?? row.messagePreview ?? ''
  await pool.query(
    `insert into notification_log(
       user_id, guardian_id, student_id, session_id, broadcast_id,
       channel, status, message_preview, message_body, error_detail,
       attempt_count, notification_type, batch_id, recipient_label
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      row.userId,
      row.guardianId || null,
      row.studentId || null,
      row.sessionId || null,
      row.broadcastId || null,
      row.channel || 'telegram',
      row.status,
      messagePreviewFromBody(body),
      body || null,
      row.errorDetail || null,
      row.attemptCount || 1,
      row.notificationType || null,
      row.batchId || null,
      row.recipientLabel || null,
    ]
  )
}

async function sendToGuardian({
  userId,
  guardianId,
  studentId,
  sessionId,
  broadcastId,
  chatId,
  text,
  notificationType,
  batchId,
  recipientLabel,
}) {
  const logBase = {
    userId,
    guardianId,
    studentId,
    sessionId,
    broadcastId,
    messageBody: text,
    notificationType,
    batchId,
    recipientLabel,
  }

  if (!isTelegramConfigured()) {
    await logNotification({
      ...logBase,
      status: 'failed',
      errorDetail: 'TELEGRAM_BOT_TOKEN not configured',
    })
    return 'failed'
  }

  let attemptCount = 1
  try {
    await sendMessage(chatId, text)
    await logNotification({
      ...logBase,
      status: 'sent',
      attemptCount,
    })
    return 'sent'
  } catch (e) {
    if (shouldRetry(e)) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      attemptCount = 2
      try {
        await sendMessage(chatId, text)
        await logNotification({
          ...logBase,
          status: 'sent',
          attemptCount,
        })
        return 'sent'
      } catch (e2) {
        await logNotification({
          ...logBase,
          status: 'failed',
          errorDetail: e2.message,
          attemptCount,
        })
        return 'failed'
      }
    }
    await logNotification({
      ...logBase,
      status: 'failed',
      errorDetail: e.message,
      attemptCount,
    })
    return 'failed'
  }
}

export async function notifySessionResult({ userId, sessionRow, studentRow }) {
  const stats = { sent: 0, failed: 0, noLink: 0, optOut: 0, skippedNoRecipient: false, total: 0 }
  try {
    const studentId = sessionRow.student_id
    const studentName = studentRow?.name || 'الطالب'
    const { rows: recipients } = await pool.query(
      `select distinct g.id as guardian_id, gt.telegram_chat_id, gt.opt_out
       from guardian_students gs
       join guardians g on g.id = gs.guardian_id and g.user_id = $1
       left join guardian_telegram gt on gt.guardian_id = g.id
       where gs.student_id = $2
         and (gs.is_primary = true or gs.notify_on_result = true)`,
      [userId, studentId]
    )

    const settings = await getUserSettings(userId)
    const text = buildSessionResultMessage({
      studentName,
      student: studentRow,
      session: sessionRow,
      sheikhName: settings?.sheikh_name,
      masjidName: settings?.masjid_name,
    })

    stats.total = recipients.length

    if (!recipients.length) {
      stats.skippedNoRecipient = true
      await logNotification({
        userId,
        studentId,
        sessionId: sessionRow.id,
        status: 'skipped_no_recipient',
        messageBody: text,
        notificationType: 'session_result',
      })
      return stats
    }

    for (const r of recipients) {
      if (!r.telegram_chat_id) {
        stats.noLink++
        await logNotification({
          userId,
          guardianId: r.guardian_id,
          studentId,
          sessionId: sessionRow.id,
          status: 'no_telegram_link',
          messageBody: text,
          notificationType: 'session_result',
        })
        continue
      }
      if (r.opt_out) {
        stats.optOut++
        await logNotification({
          userId,
          guardianId: r.guardian_id,
          studentId,
          sessionId: sessionRow.id,
          status: 'opt_out',
          messageBody: text,
          notificationType: 'session_result',
        })
        continue
      }
      const status = await sendToGuardian({
        userId,
        guardianId: r.guardian_id,
        studentId,
        sessionId: sessionRow.id,
        chatId: r.telegram_chat_id,
        text,
        notificationType: 'session_result',
      })
      if (status === 'sent') stats.sent++
      else stats.failed++
    }
    return stats
  } catch (e) {
    console.error('[notification] notifySessionResult failed', e.message)
    return stats
  }
}

export async function resendSessionResultNotification(userId, sessionId) {
  const { rows: sessionRows } = await pool.query(
    `select s.*
     from sessions s
     join students st on st.id = s.student_id
     where s.id = $1 and st.user_id = $2`,
    [sessionId, userId]
  )
  if (!sessionRows.length) {
    throw Object.assign(new Error('المحاولة غير موجودة'), { status: 404 })
  }
  const sessionRow = sessionRows[0]
  const { rows: studentRows } = await pool.query(
    `select id, name, current_naqza, memorization_thumun_id, memorization_surah, qalam_count
     from students where id = $1 and user_id = $2`,
    [sessionRow.student_id, userId]
  )
  if (!studentRows.length) {
    throw Object.assign(new Error('الطالب غير موجود'), { status: 404 })
  }
  const stats = await notifySessionResult({
    userId,
    sessionRow,
    studentRow: studentRows[0],
  })
  return { sessionId, stats }
}

function buildSessionAttendanceFooter({ sheikhName, masjidName }) {
  const parts = []
  if (masjidName) parts.push(`🕌 ${masjidName}`)
  if (sheikhName) parts.push(`بإشراف الشيخ ${sheikhName}`)
  return parts.join('\n')
}

// Weekly attendance messages are intended for Saturday evening in Africa/Tripoli,
// after the configured halaqa week has ended. This function is side-effectful and
// can be called by a scheduler or maintenance route; it never sends daily/per-scan pings.
export async function sendWeeklyAttendanceNotifications({ userId, from, to } = {}) {
  const settings = await getUserSettings(userId)
  const overview = await buildAttendanceOverview(userId, { from, to })
  const stats = { sent: 0, failed: 0, noLink: 0, optOut: 0, skipped: 0, eligible: 0 }

  const { rows } = await pool.query(
    `select gs.student_id, gs.guardian_id, gt.telegram_chat_id, gt.opt_out,
            st.name as student_name, st.memorization_thumun_id, st.memorization_surah
     from guardian_students gs
     join guardians g on g.id = gs.guardian_id and g.user_id = $1
     join students st on st.id = gs.student_id and st.user_id = $1
     left join guardian_telegram gt on gt.guardian_id = g.id
     where gs.notify_weekly_attendance = true
     order by st.number asc`,
    [userId]
  )
  stats.eligible = rows.length
  const batchId = randomUUID()

  const byStudent = new Map(overview.students.map(student => [student.id, student]))
  for (const row of rows) {
    const student = byStudent.get(row.student_id)
    if (!student) {
      stats.skipped++
      continue
    }
    const summary = {
      from: overview.from,
      to: overview.to,
      presentCount: student.presentCount,
      absentCount: student.absentCount,
      studyDayCount: student.studyDayCount,
    }
    const text = buildWeeklyAttendanceGuardianMessage({
      studentName: row.student_name,
      student: { memorization_thumun_id: row.memorization_thumun_id, memorization_surah: row.memorization_surah },
      summary,
      statuses: student.statuses,
      sheikhName: settings?.sheikh_name,
      masjidName: settings?.masjid_name,
    })
    if (!row.telegram_chat_id) {
      stats.noLink++
      await logNotification({
        userId,
        guardianId: row.guardian_id,
        studentId: row.student_id,
        status: 'no_telegram_link',
        messageBody: text,
        notificationType: 'weekly_attendance',
        batchId,
      })
      continue
    }
    if (row.opt_out) {
      stats.optOut++
      await logNotification({
        userId,
        guardianId: row.guardian_id,
        studentId: row.student_id,
        status: 'opt_out',
        messageBody: text,
        notificationType: 'weekly_attendance',
        batchId,
      })
      continue
    }
    const status = await sendToGuardian({
      userId,
      guardianId: row.guardian_id,
      studentId: row.student_id,
      chatId: row.telegram_chat_id,
      text,
      notificationType: 'weekly_attendance',
      batchId,
    })
    if (status === 'sent') stats.sent++
    else stats.failed++
  }

  return { ...stats, from: overview.from, to: overview.to, batchId }
}

async function resolveSheikhReportChatId(userId) {
  const chatIdEnv = String(process.env.TELEGRAM_REPORT_CHAT_ID || '').trim()
  if (chatIdEnv) return { chatId: chatIdEnv, guardianId: null }

  const phoneRaw = String(process.env.TELEGRAM_REPORT_PHONE || '').trim()
  if (!phoneRaw) {
    throw Object.assign(
      new Error('اضبط TELEGRAM_REPORT_PHONE أو TELEGRAM_REPORT_CHAT_ID في server/.env'),
      { status: 400 }
    )
  }
  const phoneE164 = normalizePhoneE164(phoneRaw)
  if (!phoneE164) {
    throw Object.assign(new Error('رقم Telegram غير صالح في الإعدادات'), { status: 400 })
  }

  const { rows } = await pool.query(
    `select g.id as guardian_id, g.phone_e164, gt.telegram_chat_id
     from guardians g
     join guardian_telegram gt on gt.guardian_id = g.id
     where g.user_id = $1 and coalesce(gt.opt_out, false) = false`,
    [userId]
  )
  const linked = rows.find(row => phonesEquivalent(row.phone_e164, phoneE164))
  if (linked?.telegram_chat_id) {
    return { chatId: String(linked.telegram_chat_id), guardianId: linked.guardian_id }
  }

  throw Object.assign(
    new Error(
      'لم يتم العثور على ربط Telegram لهذا الرقم. أرسل /start للبوت ثم أضف الرقم كولي أمر مربوط، أو ضع TELEGRAM_REPORT_CHAT_ID في server/.env'
    ),
    { status: 400 }
  )
}

export async function sendAttendanceOverviewReport({ userId, from, to } = {}) {
  if (!isTelegramConfigured()) {
    throw Object.assign(new Error('Telegram غير مفعّل على الخادم'), { status: 503 })
  }
  const settings = await getUserSettings(userId)
  const overview = await buildAttendanceOverview(userId, { from, to })
  const text = buildAttendanceOverviewReportMessage(overview, settings)
  const { chatId, guardianId } = await resolveSheikhReportChatId(userId)
  const status = await sendToGuardian({
    userId,
    guardianId,
    chatId,
    text,
    notificationType: 'attendance_overview_report',
    recipientLabel: 'إلى الشيخ',
  })
  if (status !== 'sent') {
    throw Object.assign(new Error('تعذّر إرسال التقرير على Telegram'), { status: 502 })
  }
  return { ok: true, status, from: overview.from, to: overview.to }
}

export async function broadcastMessage({ userId, message, targetType, targetId, targetIds }) {
  const stats = { sent: 0, failed: 0, noLink: 0, optOut: 0 }

  const broadcastQ = await pool.query(
    `insert into broadcasts(user_id, message_text, target_type, target_id)
     values($1, $2, $3, $4) returning id`,
    [userId, message, targetType, targetId || null]
  )
  const broadcastId = broadcastQ.rows[0].id

  let guardians = []

  if (targetType === 'all') {
    const { rows } = await pool.query(
      `select distinct g.id as guardian_id, gt.telegram_chat_id, gt.opt_out
       from guardians g
       left join guardian_telegram gt on gt.guardian_id = g.id
       where g.user_id = $1`,
      [userId]
    )
    guardians = rows
  } else if (targetType === 'student') {
    if (!targetId) throw Object.assign(new Error('targetId مطلوب'), { status: 400 })
    const owned = await pool.query(
      'select id from students where id=$1 and user_id=$2',
      [targetId, userId]
    )
    if (!owned.rows.length) throw Object.assign(new Error('الطالب غير موجود'), { status: 404 })

    const { rows } = await pool.query(
      `select distinct g.id as guardian_id, gt.telegram_chat_id, gt.opt_out
       from guardian_students gs
       join guardians g on g.id = gs.guardian_id and g.user_id = $1
       left join guardian_telegram gt on gt.guardian_id = g.id
       where gs.student_id = $2`,
      [userId, targetId]
    )
    guardians = rows
  } else if (targetType === 'family') {
    if (!targetId) throw Object.assign(new Error('targetId مطلوب'), { status: 400 })
    const familyQ = await pool.query(
      'select id from families where id=$1 and user_id=$2',
      [targetId, userId]
    )
    if (!familyQ.rows.length) throw Object.assign(new Error('العائلة غير موجودة'), { status: 404 })

    const { rows } = await pool.query(
      `select distinct g.id as guardian_id, gt.telegram_chat_id, gt.opt_out
       from family_students fs
       join guardian_students gs on gs.student_id = fs.student_id
       join guardians g on g.id = gs.guardian_id and g.user_id = $1
       left join guardian_telegram gt on gt.guardian_id = g.id
       where fs.family_id = $2`,
      [userId, targetId]
    )
    guardians = rows
  } else if (targetType === 'guardians') {
    const ids = Array.isArray(targetIds) ? targetIds.filter(Boolean) : []
    if (!ids.length) throw Object.assign(new Error('اختر ولياً واحداً على الأقل'), { status: 400 })

    const { rows } = await pool.query(
      `select g.id as guardian_id, gt.telegram_chat_id, gt.opt_out
       from guardians g
       left join guardian_telegram gt on gt.guardian_id = g.id
       where g.user_id = $1 and g.id = any($2::uuid[])`,
      [userId, ids]
    )
    if (!rows.length) throw Object.assign(new Error('أولياء الأمور غير موجودين'), { status: 404 })
    guardians = rows
  } else {
    throw Object.assign(new Error('targetType غير صالح'), { status: 400 })
  }

  for (const g of guardians) {
    if (!g.telegram_chat_id) {
      stats.noLink++
      await logNotification({
        userId,
        guardianId: g.guardian_id,
        broadcastId,
        status: 'no_telegram_link',
        messageBody: message,
        notificationType: 'broadcast',
      })
      continue
    }
    if (g.opt_out) {
      stats.optOut++
      await logNotification({
        userId,
        guardianId: g.guardian_id,
        broadcastId,
        status: 'opt_out',
        messageBody: message,
        notificationType: 'broadcast',
      })
      continue
    }
    const result = await sendToGuardian({
      userId,
      guardianId: g.guardian_id,
      broadcastId,
      chatId: g.telegram_chat_id,
      text: message,
      notificationType: 'broadcast',
    })
    if (result === 'sent') stats.sent++
    else stats.failed++
  }

  return { broadcastId, stats }
}

const LOG_SELECT = `
  select nl.id, nl.status, nl.message_preview, nl.message_body, nl.error_detail,
         nl.created_at, nl.student_id, nl.guardian_id, nl.session_id, nl.broadcast_id,
         nl.notification_type, nl.batch_id, nl.recipient_label, nl.channel,
         nl.attempt_count,
         coalesce(nl.message_body, nl.message_preview, b.message_text) as resolved_body,
         g.name as guardian_name,
         s.name as student_name,
         s.number as student_number
  from notification_log nl
  left join guardians g on g.id = nl.guardian_id
  left join students s on s.id = nl.student_id
  left join broadcasts b on b.id = nl.broadcast_id
`

function buildLogWhere(userId, filters = {}) {
  const params = [userId]
  let where = 'nl.user_id = $1'

  if (filters.studentId) {
    params.push(filters.studentId)
    where += ` and nl.student_id = $${params.length}`
  }
  if (filters.guardianId) {
    params.push(filters.guardianId)
    where += ` and nl.guardian_id = $${params.length}`
  }
  if (filters.sessionId) {
    params.push(filters.sessionId)
    where += ` and nl.session_id = $${params.length}`
  }
  if (filters.broadcastId) {
    params.push(filters.broadcastId)
    where += ` and nl.broadcast_id = $${params.length}`
  }
  if (filters.type && filters.type !== 'all') {
    if (filters.type === 'telegram_linked') {
      where += ` and (nl.notification_type = 'telegram_linked' or nl.status = 'telegram_linked')`
    } else {
      params.push(filters.type)
      where += ` and nl.notification_type = $${params.length}`
    }
  }
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status)
    where += ` and nl.status = $${params.length}`
  }
  if (filters.from) {
    params.push(filters.from)
    where += ` and nl.created_at >= $${params.length}::date`
  }
  if (filters.to) {
    params.push(filters.to)
    where += ` and nl.created_at < ($${params.length}::date + interval '1 day')`
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`)
    where += ` and (g.name ilike $${params.length} or s.name ilike $${params.length})`
  }

  return { where, params }
}

export async function getNotificationLog(userId, filters = {}) {
  const { where, params } = buildLogWhere(userId, filters)
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200)
  const offset = Math.max(Number(filters.offset) || 0, 0)
  params.push(limit)
  params.push(offset)

  const { rows } = await pool.query(
    `${LOG_SELECT}
     where ${where}
     order by nl.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  )
  return rows.map(row => ({
    ...row,
    message_body: row.resolved_body || row.message_body || row.message_preview,
  }))
}

export async function getNotificationLogEntry(userId, entryId) {
  const { rows } = await pool.query(
    `select nl.id, nl.status, nl.message_preview, nl.message_body, nl.error_detail,
            nl.created_at, nl.student_id, nl.guardian_id, nl.session_id, nl.broadcast_id,
            nl.notification_type, nl.batch_id, nl.recipient_label, nl.channel,
            nl.attempt_count,
            coalesce(nl.message_body, nl.message_preview, b.message_text) as resolved_body,
            g.name as guardian_name,
            s.name as student_name,
            s.number as student_number,
            sess.passed as session_passed,
            sess.score as session_score,
            sess.attempt_at as session_attempt_at
     from notification_log nl
     left join guardians g on g.id = nl.guardian_id
     left join students s on s.id = nl.student_id
     left join broadcasts b on b.id = nl.broadcast_id
     left join sessions sess on sess.id = nl.session_id
     where nl.user_id = $1 and nl.id = $2
     limit 1`,
    [userId, entryId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    message_body: row.resolved_body || row.message_body || row.message_preview,
  }
}

export async function getNotificationLogStats(userId, { from, to } = {}) {
  const { where, params } = buildLogWhere(userId, { from, to })
  const { rows } = await pool.query(
    `select
       count(*) filter (where nl.status = 'sent')::int as sent,
       count(*) filter (where nl.status = 'failed')::int as failed,
       count(*) filter (where nl.status = 'no_telegram_link')::int as no_link,
       count(*) filter (where nl.status in ('failed', 'no_telegram_link'))::int as needs_attention,
       count(*)::int as total
     from notification_log nl
     left join guardians g on g.id = nl.guardian_id
     left join students s on s.id = nl.student_id
     where ${where}`,
    params
  )
  return rows[0] || { sent: 0, failed: 0, no_link: 0, needs_attention: 0, total: 0 }
}

export async function logTelegramLinkActivity({
  userId,
  guardianId,
  studentName,
  telegramDisplayName,
  telegramUsername,
}) {
  const studentQ = await pool.query(
    `select gs.student_id, s.name
     from guardian_students gs
     join students s on s.id = gs.student_id
     where gs.guardian_id = $1
     order by gs.is_primary desc, s.number asc
     limit 1`,
    [guardianId]
  )
  const studentRow = studentQ.rows[0]
  const resolvedStudentName = studentName || studentRow?.name || 'الطالب'
  let preview = `تم ربط ولي أمر الطالب ${resolvedStudentName} بحساب Telegram.`
  const tgParts = []
  if (telegramDisplayName) tgParts.push(telegramDisplayName)
  if (telegramUsername) tgParts.push(`@${String(telegramUsername).replace(/^@/, '')}`)
  if (tgParts.length) preview += ` (${tgParts.join(' · ')})`

  await logNotification({
    userId,
    guardianId,
    studentId: studentRow?.student_id || null,
    channel: 'telegram',
    status: 'telegram_linked',
    messageBody: preview,
    notificationType: 'telegram_linked',
  })
}

function pad2(n) { return String(n).padStart(2, '0') }
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export async function getTodaySessions(userId, date = null) {
  const targetDate = date || localDateStr()
  const { rows } = await pool.query(
    `select distinct on (s.student_id)
       s.id, s.student_id, s.passed, s.score, s.mode, s.attempt_at,
       st.name as student_name, st.number as student_number,
       st.memorization_thumun_id, st.memorization_surah, st.qalam_count
     from sessions s
     join students st on st.id = s.student_id
     where st.user_id = $1
       and s.attempt_at >= $2::date
       and s.attempt_at < ($2::date + interval '1 day')
     order by s.student_id, s.attempt_at desc`,
    [userId, targetDate]
  )
  return { date: targetDate, sessions: rows }
}

export async function sendTodayResultsNotifications(userId, { studentIds = null, date = null } = {}) {
  const targetDate = date || localDateStr()

  let query = `
    select distinct on (s.student_id)
      s.*,
      st.name as student_name,
      st.memorization_thumun_id, st.memorization_surah, st.qalam_count
    from sessions s
    join students st on st.id = s.student_id
    where st.user_id = $1
      and s.attempt_at >= $2::date
      and s.attempt_at < ($2::date + interval '1 day')`

  const params = [userId, targetDate]
  if (Array.isArray(studentIds) && studentIds.length) {
    query += ` and s.student_id = any($3::int[])`
    params.push(studentIds)
  }
  query += ` order by s.student_id, s.attempt_at desc`

  const { rows: sessionRows } = await pool.query(query, params)

  const results = []
  for (const row of sessionRows) {
    const studentRow = {
      id: row.student_id,
      name: row.student_name,
      memorization_thumun_id: row.memorization_thumun_id,
      memorization_surah: row.memorization_surah,
      qalam_count: row.qalam_count,
    }
    const stats = await notifySessionResult({ userId, sessionRow: row, studentRow })
    results.push({ studentId: row.student_id, studentName: row.student_name, sessionId: row.id, stats })
  }

  const summary = { sent: 0, failed: 0, noLink: 0, optOut: 0, skippedNoRecipient: 0, total: sessionRows.length }
  for (const r of results) {
    summary.sent += r.stats.sent || 0
    summary.failed += r.stats.failed || 0
    summary.noLink += r.stats.noLink || 0
    summary.optOut += r.stats.optOut || 0
    if (r.stats.skippedNoRecipient) summary.skippedNoRecipient++
  }

  return { date: targetDate, results, summary }
}
