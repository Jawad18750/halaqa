import { pool } from './db.js'
import { sendMessage, shouldRetry, isTelegramConfigured } from './telegramBot.js'
import { buildSessionResultMessage } from './sessionMessage.js'
import { getUserSettings } from './userSettings.js'

const RETRY_DELAY_MS = 2000

async function logNotification(row) {
  await pool.query(
    `insert into notification_log(
       user_id, guardian_id, student_id, session_id, broadcast_id,
       channel, status, message_preview, error_detail, attempt_count
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      row.userId,
      row.guardianId || null,
      row.studentId || null,
      row.sessionId || null,
      row.broadcastId || null,
      row.channel || 'telegram',
      row.status,
      (row.messagePreview || '').slice(0, 500),
      row.errorDetail || null,
      row.attemptCount || 1,
    ]
  )
}

async function sendToGuardian({ userId, guardianId, studentId, sessionId, broadcastId, chatId, text }) {
  if (!isTelegramConfigured()) {
    await logNotification({
      userId,
      guardianId,
      studentId,
      sessionId,
      broadcastId,
      status: 'failed',
      messagePreview: text,
      errorDetail: 'TELEGRAM_BOT_TOKEN not configured',
    })
    return 'failed'
  }

  let attemptCount = 1
  try {
    await sendMessage(chatId, text)
    await logNotification({
      userId,
      guardianId,
      studentId,
      sessionId,
      broadcastId,
      status: 'sent',
      messagePreview: text,
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
          userId,
          guardianId,
          studentId,
          sessionId,
          broadcastId,
          status: 'sent',
          messagePreview: text,
          attemptCount,
        })
        return 'sent'
      } catch (e2) {
        await logNotification({
          userId,
          guardianId,
          studentId,
          sessionId,
          broadcastId,
          status: 'failed',
          messagePreview: text,
          errorDetail: e2.message,
          attemptCount,
        })
        return 'failed'
      }
    }
    await logNotification({
      userId,
      guardianId,
      studentId,
      sessionId,
      broadcastId,
      status: 'failed',
      messagePreview: text,
      errorDetail: e.message,
      attemptCount,
    })
    return 'failed'
  }
}

export async function notifySessionResult({ userId, sessionRow, studentRow }) {
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

    if (!recipients.length) {
      const settings = await getUserSettings(userId)
      await logNotification({
        userId,
        studentId,
        sessionId: sessionRow.id,
        status: 'skipped_no_recipient',
        messagePreview: buildSessionResultMessage({
          studentName,
          session: sessionRow,
          sheikhName: settings?.sheikh_name,
          masjidName: settings?.masjid_name,
        }),
      })
      return
    }

    const settings = await getUserSettings(userId)
    const text = buildSessionResultMessage({
      studentName,
      session: sessionRow,
      sheikhName: settings?.sheikh_name,
      masjidName: settings?.masjid_name,
    })

    for (const r of recipients) {
      if (!r.telegram_chat_id) {
        await logNotification({
          userId,
          guardianId: r.guardian_id,
          studentId,
          sessionId: sessionRow.id,
          status: 'no_telegram_link',
          messagePreview: text,
        })
        continue
      }
      if (r.opt_out) {
        await logNotification({
          userId,
          guardianId: r.guardian_id,
          studentId,
          sessionId: sessionRow.id,
          status: 'opt_out',
          messagePreview: text,
        })
        continue
      }
      await sendToGuardian({
        userId,
        guardianId: r.guardian_id,
        studentId,
        sessionId: sessionRow.id,
        chatId: r.telegram_chat_id,
        text,
      })
    }
  } catch (e) {
    console.error('[notification] notifySessionResult failed', e.message)
  }
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
        messagePreview: message,
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
        messagePreview: message,
      })
      continue
    }
    const result = await sendToGuardian({
      userId,
      guardianId: g.guardian_id,
      broadcastId,
      chatId: g.telegram_chat_id,
      text: message,
    })
    if (result === 'sent') stats.sent++
    else stats.failed++
  }

  return { broadcastId, stats }
}

export async function getNotificationLog(userId, { limit = 50, studentId } = {}) {
  const params = [userId]
  let where = 'nl.user_id = $1'
  if (studentId) {
    params.push(studentId)
    where += ` and nl.student_id = $${params.length}`
  }
  params.push(Math.min(Number(limit) || 50, 200))

  const { rows } = await pool.query(
    `select nl.id, nl.status, nl.message_preview, nl.error_detail, nl.created_at,
            nl.student_id, nl.guardian_id, nl.session_id, nl.broadcast_id,
            g.name as guardian_name,
            s.name as student_name
     from notification_log nl
     left join guardians g on g.id = nl.guardian_id
     left join students s on s.id = nl.student_id
     where ${where}
     order by nl.created_at desc
     limit $${params.length}`,
    params
  )
  return rows
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
    messagePreview: preview,
  })
}
