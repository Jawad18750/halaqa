import { pool } from './db.js'
import { sendMessage } from './telegramBot.js'
import { buildHalaqaSignature, normalizeLinkCode, formatLinkCodeForDisplay } from './messageContext.js'
import { logTelegramLinkActivity } from './notificationService.js'

const pendingCodes = new Map()
const BOT_USERNAME = 'Halaqa_Test_bot'

function buildTelegramDisplayName(from) {
  if (!from) return null
  const parts = [from.first_name, from.last_name]
    .map(v => String(v || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

function extractCode(text) {
  if (!text) return null
  const trimmed = text.trim()
  const startMatch = trimmed.match(/^\/start(?:@\w+)?\s+(\S+)/i)
  if (startMatch) return normalizeLinkCode(startMatch[1])
  return normalizeLinkCode(trimmed)
}

async function getStudentNamesForGuardian(guardianId) {
  const { rows } = await pool.query(
    `select s.name from guardian_students gs
     join students s on s.id = gs.student_id
     where gs.guardian_id = $1
     order by s.number asc`,
    [guardianId]
  )
  return rows.map(r => r.name)
}

function buildSuccessLinkMessage({ guardianName, studentNames, sheikhName, masjidName }) {
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const gName = String(guardianName || '').trim()
  const names = studentNames.filter(Boolean)
  const lines = ['✅ تم الربط بنجاح.']

  if (gName) lines.push(`ولي الأمر: ${gName}`)

  if (names.length === 1) {
    lines.push(`الطالب المرتبط: ${names[0]}`)
  } else if (names.length > 1) {
    lines.push(`الطلاب المرتبطون: ${names.join('، ')}`)
  }

  lines.push(
    'من الآن، ستصلكم نتائج الاختبارات تلقائيًا عبر هذا البوت.',
    'لإيقاف الإشعارات أرسلوا: /stop',
  )

  if (halaqaFooter) lines.push(halaqaFooter)
  lines.push('بارك الله فيكم.')
  return lines.join('\n')
}

async function redeemLinkCode(code, chatId, fromUser) {
  const normalized = normalizeLinkCode(code)
  const username = fromUser?.username || null
  const displayName = buildTelegramDisplayName(fromUser)
  if (!normalized) {
    return {
      ok: false,
      message: [
        'تعذّر إتمام الربط بهذا الرمز.',
        'يرجى التأكد من إدخال رمز الربط كما أرسله معلّم الحلقة، أو طلب رمز جديد إذا انتهت صلاحيته.',
        'مثال: 482 917',
      ].join('\n'),
    }
  }

  const { rows } = await pool.query(
    `select tlc.*, g.name as guardian_name, u.sheikh_name, u.masjid_name
     from telegram_link_codes tlc
     join guardians g on g.id = tlc.guardian_id
     join users u on u.id = tlc.user_id
     where tlc.code = $1 and tlc.used_at is null and tlc.expires_at > now()`,
    [normalized]
  )

  if (!rows.length) {
    return {
      ok: false,
      message: [
        'تعذّر إتمام الربط بهذا الرمز.',
        'يرجى التأكد من إدخال رمز الربط كما أرسله معلّم الحلقة، أو طلب رمز جديد إذا انتهت صلاحيته.',
        'مثال: 482 917',
      ].join('\n'),
    }
  }

  const row = rows[0]
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into guardian_telegram(guardian_id, telegram_chat_id, telegram_username, telegram_display_name, linked_at, opt_out)
       values($1, $2, $3, $4, now(), false)
       on conflict (guardian_id) do update set
         telegram_chat_id=excluded.telegram_chat_id,
         telegram_username=excluded.telegram_username,
         telegram_display_name=excluded.telegram_display_name,
         linked_at=now(),
         opt_out=false`,
      [row.guardian_id, chatId, username || null, displayName]
    )
    await client.query(
      'update telegram_link_codes set used_at=now() where id=$1',
      [row.id]
    )
    await client.query('commit')

    const names = await getStudentNamesForGuardian(row.guardian_id)

    try {
      await logTelegramLinkActivity({
        userId: row.user_id,
        guardianId: row.guardian_id,
        studentName: names[0] || null,
        telegramDisplayName: displayName,
        telegramUsername: username,
      })
    } catch (e) {
      console.error('[telegram] link activity log failed', e.message)
    }

    return {
      ok: true,
      message: buildSuccessLinkMessage({
        guardianName: row.guardian_name,
        studentNames: names,
        sheikhName: row.sheikh_name,
        masjidName: row.masjid_name,
      }),
    }
  } catch (e) {
    await client.query('rollback')
    console.error('[telegram] redeem failed', e.message)
    return {
      ok: false,
      message: '⚠️ تعذّر إتمام الربط حاليًا بسبب خطأ تقني.\nيرجى المحاولة مرة أخرى، وإذا استمرت المشكلة فتواصلوا مع معلّم الحلقة.',
    }
  } finally {
    client.release()
  }
}

async function handleOptOut(chatId) {
  const { rowCount } = await pool.query(
    `update guardian_telegram set opt_out=true where telegram_chat_id=$1`,
    [chatId]
  )
  if (rowCount) {
    return '🔕 تم إيقاف إشعارات النتائج.\nلإعادة تفعيل الإشعارات أرسلوا: /resume'
  }
  return 'لا يوجد حساب طالب مرتبط بهذا الحساب حاليًا.\nللربط، استخدموا الرابط أو الرمز المرسل من معلّم الحلقة.'
}

async function handleResume(chatId) {
  const { rowCount } = await pool.query(
    `update guardian_telegram set opt_out=false where telegram_chat_id=$1`,
    [chatId]
  )
  if (rowCount) {
    return '🔔 تم تفعيل إشعارات النتائج من جديد.\nستصلكم نتائج الاختبارات القادمة تلقائيًا عبر هذا البوت.'
  }
  return 'لا يوجد ربط سابق يمكن إعادة تفعيله حاليًا.\nيرجى طلب رابط ربط جديد من معلّم الحلقة.'
}

export async function handleTelegramMessage(msg) {
  const chatId = msg.chat?.id
  const text = msg.text || ''
  const fromUser = msg.from || null

  if (!chatId) return

  const lower = text.trim().toLowerCase()

  if (lower === '/help' || lower.startsWith('/help@')) {
    await sendMessage(chatId, [
      '📖 مساعدة بوت حلقة القرآن الكريم',
      'للربط:',
      '- اضغطوا رابط الدعوة الذي أرسله معلّم الحلقة.',
      '- أو أرسلوا رمز الربط المكوّن من 6 أرقام.',
      'بعد الربط:',
      '- ستصلكم نتائج الاختبارات تلقائيًا.',
      '- لإيقاف الإشعارات أرسلوا: /stop',
      '- لإعادة تفعيل الإشعارات أرسلوا: /resume',
      'إذا انتهت صلاحية رمز الربط، اطلبوا رمزًا جديدًا من معلّم الحلقة.',
    ].join('\n'))
    return
  }

  if (lower === '/stop' || lower.startsWith('/stop@')) {
    const reply = await handleOptOut(chatId)
    await sendMessage(chatId, reply)
    return
  }

  if (lower === '/resume' || lower.startsWith('/resume@')) {
    const reply = await handleResume(chatId)
    await sendMessage(chatId, reply)
    return
  }

  const code = extractCode(text)
  if (code) {
    const result = await redeemLinkCode(code, chatId, fromUser)
    await sendMessage(chatId, result.message)
    pendingCodes.delete(chatId)
    return
  }

  if (lower === '/start' || lower.startsWith('/start@')) {
    pendingCodes.set(chatId, Date.now())
    await sendMessage(chatId, [
      'السلام عليكم ورحمة الله وبركاته.',
      '📖 هذا هو بوت متابعة نتائج الطلاب في حلقة القرآن الكريم.',
      'لربط حسابكم بولي الأمر:',
      '1. اضغطوا رابط الدعوة الذي أرسله معلّم الحلقة.',
      '2. أو أرسلوا رمز الربط المكوّن من 6 أرقام.',
      'بعد إتمام الربط، ستصلكم نتائج الاختبارات تلقائيًا عبر هذا البوت.',
      'للمساعدة أرسلوا: /help',
    ].join('\n'))
    return
  }

  if (pendingCodes.has(chatId)) {
    const maybeCode = normalizeLinkCode(text.trim())
    if (maybeCode) {
      const result = await redeemLinkCode(maybeCode, chatId, fromUser)
      await sendMessage(chatId, result.message)
      pendingCodes.delete(chatId)
      return
    }
  }

  await sendMessage(chatId, [
    'لم نتمكن من فهم الرسالة.',
    'يرجى إرسال رمز الربط المكوّن من 6 أرقام، أو استخدام رابط الدعوة الذي أرسله معلّم الحلقة.',
    'للمساعدة أرسلوا: /help',
  ].join('\n'))
}

export async function handleTelegramUpdate(update) {
  if (update?.message) {
    await handleTelegramMessage(update.message)
  }
}

export { normalizeLinkCode, formatLinkCodeForDisplay, BOT_USERNAME }
