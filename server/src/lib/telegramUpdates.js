import { pool } from './db.js'
import { sendMessage } from './telegramBot.js'
import { buildHalaqaSignature } from './messageContext.js'

const pendingCodes = new Map()

function normalizeCode(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (/^\d{5,6}$/.test(digits)) return digits
  // Legacy 8-char hex codes still in circulation
  const hex = String(raw).trim().toUpperCase()
  if (/^[A-F0-9]{8}$/.test(hex)) return hex
  return null
}

function extractCode(text) {
  if (!text) return null
  const trimmed = text.trim()
  const startMatch = trimmed.match(/^\/start(?:@\w+)?\s+(\S+)/i)
  if (startMatch) return normalizeCode(startMatch[1])
  return normalizeCode(trimmed)
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

async function redeemLinkCode(code, chatId, username) {
  const { rows } = await pool.query(
    `select tlc.*, g.name as guardian_name, u.sheikh_name, u.masjid_name
     from telegram_link_codes tlc
     join guardians g on g.id = tlc.guardian_id
     join users u on u.id = tlc.user_id
     where tlc.code = $1 and tlc.used_at is null and tlc.expires_at > now()`,
    [code]
  )
  if (!rows.length) {
    return {
      ok: false,
      message: [
        '❌ الرقم غير صحيح أو انتهت صلاحيته.',
        '',
        '📱 اطلب رقماً جديداً من معلّم الحلقة.',
        '💡 تأكد من إدخال الأرقام فقط — مثل: 482 917',
      ].join('\n'),
    }
  }

  const row = rows[0]
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into guardian_telegram(guardian_id, telegram_chat_id, telegram_username, linked_at, opt_out)
       values($1, $2, $3, now(), false)
       on conflict (guardian_id) do update set
         telegram_chat_id=excluded.telegram_chat_id,
         telegram_username=excluded.telegram_username,
         linked_at=now(),
         opt_out=false`,
      [row.guardian_id, chatId, username || null]
    )
    await client.query(
      'update telegram_link_codes set used_at=now() where id=$1',
      [row.id]
    )
    await client.query('commit')

    const names = await getStudentNamesForGuardian(row.guardian_id)
    const studentsText = names.length ? names.join('، ') : '—'
    const halaqaFooter = buildHalaqaSignature({
      sheikhName: row.sheikh_name,
      masjidName: row.masjid_name,
      style: 'footer',
    })
    const successLines = [
      '✅ تم الربط بنجاح!',
      '',
      `🌙 مرحباً ${row.guardian_name}`,
      `👨‍👩‍👧 الطلاب المرتبطون: ${studentsText}`,
      '',
      '📬 من الآن ستصلكم رسالة تلقائياً بعد كل اختبار.',
      '🔕 لإيقاف الإشعارات أرسل: /stop',
    ]
    if (halaqaFooter) {
      successLines.push('', halaqaFooter)
    }
    successLines.push('', 'بارك الله فيكم 🤲')
    return {
      ok: true,
      message: successLines.join('\n'),
    }
  } catch (e) {
    await client.query('rollback')
    console.error('[telegram] redeem failed', e.message)
    return {
      ok: false,
      message: '⚠️ حدث خطأ أثناء الربط. حاول مرة أخرى أو اطلب رقماً جديداً من المعلّم.',
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
    return [
      '🔕 تم إيقاف الإشعارات.',
      '',
      '📱 لإعادة التفعيل اطلب رقماً جديداً من معلّم الحلقة وارسله هنا.',
    ].join('\n')
  }
  return [
    'ℹ️ لا يوجد حساب مرتبط.',
    '',
    '📱 اطلب رقم الربط من معلّم الحلقة واضغط الرابط أو أرسل الرقم هنا.',
  ].join('\n')
}

export async function handleTelegramMessage(msg) {
  const chatId = msg.chat?.id
  const text = msg.text || ''
  const username = msg.from?.username || null

  if (!chatId) return

  const lower = text.trim().toLowerCase()

  if (lower === '/help' || lower.startsWith('/help@')) {
    await sendMessage(chatId, [
      '📖 مساعدة بوت حلقة الاختبار',
      '',
      '🔗 ربط حسابك (مرة واحدة):',
      '• اضغط الرابط الذي أرسله المعلّم',
      '• أو أرسل الرقم المكوّن من 6 أرقام',
      '',
      '📬 بعد الربط — تصلك نتائج الاختبار تلقائياً',
      '🔕 /stop — إيقاف الإشعارات',
      '❓ /help — هذه الرسالة',
    ].join('\n'))
    return
  }

  if (lower === '/stop' || lower.startsWith('/stop@')) {
    const reply = await handleOptOut(chatId)
    await sendMessage(chatId, reply)
    return
  }

  const code = extractCode(text)
  if (code) {
    const result = await redeemLinkCode(code, chatId, username)
    await sendMessage(chatId, result.message)
    pendingCodes.delete(chatId)
    return
  }

  if (lower === '/start' || lower.startsWith('/start@')) {
    pendingCodes.set(chatId, Date.now())
    await sendMessage(chatId, [
      '🌙 السلام عليكم! 👋',
      '',
      '📚 هذا البوت لإرسال نتائج اختبار القرآن لأولياء الأمور.',
      '',
      '✅ للربط:',
      '1️⃣ اضغط الرابط الذي أرسله المعلّم',
      '   — أو —',
      '2️⃣ أرسل الرقم المكوّن من 6 أرقام (مثل: 482917)',
      '',
      '💡 بعد الربط ستصلكم النتائج تلقائياً 📬',
    ].join('\n'))
    return
  }

  if (pendingCodes.has(chatId)) {
    const maybeCode = normalizeCode(text.trim())
    if (maybeCode) {
      const result = await redeemLinkCode(maybeCode, chatId, username)
      await sendMessage(chatId, result.message)
      pendingCodes.delete(chatId)
      return
    }
  }

  await sendMessage(chatId, [
    '🤔 لم أفهم الرسالة.',
    '',
    '📱 أرسل رقم الربط (6 أرقام) من المعلّم،',
    'أو اضغط الرابط مباشرة.',
    '',
    '❓ /help — للمساعدة',
  ].join('\n'))
}

export async function handleTelegramUpdate(update) {
  if (update?.message) {
    await handleTelegramMessage(update.message)
  }
}
