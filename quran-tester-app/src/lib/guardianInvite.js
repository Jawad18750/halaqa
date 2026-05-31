import { buildHalaqaIntro } from './messageContext.js'

const BOT_USERNAME = 'Halaqa_Test_bot'

/** Emoji via escapes — survives any source file encoding; used for Telegram + copy/paste */
const E = {
  moon: '\u{1F319}',
  book: '\u{1F4DA}',
  person: '\u{1F464}',
  check: '\u{2705}',
  one: '\u{0031}\u{FE0F}\u{20E3}',
  two: '\u{0032}\u{FE0F}\u{20E3}',
  three: '\u{0033}\u{FE0F}\u{20E3}',
  link: '\u{1F517}',
  phone: '\u{1F4F1}',
  bulb: '\u{1F4A1}',
  question: '\u{2753}',
  mail: '\u{1F4EC}',
  pray: '\u{1F932}',
  send: '\u{1F4E4}',
}

export const INVITE_CHANNELS = {
  whatsapp: { id: 'whatsapp', label: 'واتساب', icon: 'fa-brands fa-whatsapp' },
  telegram: { id: 'telegram', label: 'Telegram', icon: 'fa-brands fa-telegram' },
  sms: { id: 'sms', label: 'SMS', icon: 'fa-solid fa-comment-sms' },
}

export function phoneToDigits(phoneE164) {
  return String(phoneE164 || '').replace(/\D/g, '')
}

/** Pretty display: 482917 → 482 917 */
export function formatLinkCodeForDisplay(code) {
  const digits = String(code || '').replace(/\D/g, '')
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length === 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  return digits
}

/**
 * @param {'emoji'|'plain'} [style] — plain avoids emoji for wa.me/SMS prefilled text (WhatsApp corrupts them)
 */
export function buildTelegramInviteMessage({
  guardianName,
  studentName,
  deepLink,
  code,
  sheikhName,
  masjidName,
  style = 'emoji',
}) {
  if (style === 'plain') return buildPlainInviteMessage({ guardianName, studentName, deepLink, code, sheikhName, masjidName })
  return buildEmojiInviteMessage({ guardianName, studentName, deepLink, code, sheikhName, masjidName })
}

function buildEmojiInviteMessage({ guardianName, studentName, deepLink, code, sheikhName, masjidName }) {
  const greeting = guardianName
    ? `${E.moon} السلام عليكم ${guardianName}،`
    : `${E.moon} السلام عليكم،`
  const studentLine = studentName
    ? `${E.person} الطالب: ${studentName}`
    : `${E.person} ابنكم/ابنتكم في حلقة تحفيظ القرآن`

  const codeDisplay = code ? formatLinkCodeForDisplay(code) : null

  const halaqaIntro = buildHalaqaIntro({ sheikhName, masjidName, style: 'emoji' })

  const parts = [
    greeting,
    '',
    `${halaqaIntro} — نود إبقاءكم على اطلاع بنتائج الاختبارات فور صدورها.`,
    studentLine,
    '',
    `${E.check} المطلوب منكم (مرة واحدة فقط):`,
    `${E.one} اضغط الرابط أدناه`,
    `${E.two} في Telegram اضغط «Start» أو «ابدأ»`,
    `${E.three} انتهى — ستصلكم رسالة تلقائياً بعد كل اختبار ${E.mail}`,
    '',
  ]

  if (deepLink) {
    parts.push(`${E.link} الرابط:`, deepLink, '')
  }

  if (codeDisplay) {
    parts.push(
      `${E.phone} أو يدوياً:`,
      `\u2022 افتح البوت: @${BOT_USERNAME}`,
      `\u2022 أرسل هذا الرقم فقط: ${codeDisplay}`,
      ''
    )
  }

  parts.push(
    `${E.bulb} Telegram تطبيق مجاني — مثل واتساب — لاستلام الإشعارات فقط.`,
    `${E.question} إذا لم يعمل الرابط، انسخ الرقم وأرسله للبوت مباشرة.`,
    '',
    `بارك الله فيكم ${E.pray}`
  )

  return parts.join('\n')
}

/** WhatsApp *bold* formatting — no emoji (wa.me prefilled text breaks emoji on many phones) */
function buildPlainInviteMessage({ guardianName, studentName, deepLink, code, sheikhName, masjidName }) {
  const greeting = guardianName ? `السلام عليكم ${guardianName}،` : 'السلام عليكم،'
  const studentLine = studentName
    ? `الطالب: *${studentName}*`
    : 'ابنكم/ابنتكم في حلقة تحفيظ القرآن'

  const codeDisplay = code ? formatLinkCodeForDisplay(code) : null

  const halaqaIntro = buildHalaqaIntro({ sheikhName, masjidName, style: 'plain' })

  const parts = [
    greeting,
    '',
    halaqaIntro,
    'نود إبقاءكم على اطلاع بنتائج الاختبارات فور صدورها.',
    studentLine,
    '',
    '*المطلوب منكم (مرة واحدة فقط):*',
    '1. اضغط الرابط أدناه',
    '2. في Telegram اضغط «Start» أو «ابدأ»',
    '3. انتهى — ستصلكم رسالة تلقائياً بعد كل اختبار',
    '',
  ]

  if (deepLink) {
    parts.push('*الرابط:*', deepLink, '')
  }

  if (codeDisplay) {
    parts.push(
      '*أو يدوياً:*',
      `- افتح البوت: @${BOT_USERNAME}`,
      `- أرسل هذا الرقم فقط: *${codeDisplay}*`,
      ''
    )
  }

  parts.push(
    'Telegram تطبيق مجاني — مثل واتساب — لاستلام الإشعارات فقط.',
    'إذا لم يعمل الرابط، انسخ الرقم وأرسله للبوت مباشرة.',
    '',
    'بارك الله فيكم',
  )

  return parts.join('\n')
}

function inviteMessageStyleForChannel(channel) {
  return channel === 'whatsapp' || channel === 'sms' ? 'plain' : 'emoji'
}

export function buildWhatsAppInviteUrl(phoneE164, message) {
  const digits = phoneToDigits(phoneE164)
  if (!digits) return null
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`
}

export function buildSmsInviteUrl(phoneE164, message) {
  const digits = phoneToDigits(phoneE164)
  if (!digits) return null
  return `sms:+${digits}?body=${encodeURIComponent(message)}`
}

/** Opens Telegram share picker — choose the parent chat and send. */
export function buildTelegramShareUrl(deepLink, message) {
  if (!deepLink) return null
  const text = message || deepLink
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`
}

export function getInviteUrl(channel, { phoneE164, message, deepLink, inviteParams }) {
  const text = message || (inviteParams
    ? buildTelegramInviteMessage({ ...inviteParams, style: inviteMessageStyleForChannel(channel) })
    : '')

  switch (channel) {
    case 'whatsapp':
      return buildWhatsAppInviteUrl(phoneE164, text)
    case 'sms':
      return buildSmsInviteUrl(phoneE164, text)
    case 'telegram':
      return buildTelegramShareUrl(deepLink, text)
    default:
      return null
  }
}

export function openGuardianInvite(channel, { phoneE164, message, deepLink, inviteParams }) {
  const url = getInviteUrl(channel, { phoneE164, message, deepLink, inviteParams })
  if (!url) return { channel, url: null, ok: false }

  if (channel === 'sms') {
    window.location.href = url
    return { channel, url, ok: true }
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return { channel, url, ok: !!opened }
}

export function inviteChannelToast(channel) {
  switch (channel) {
    case 'whatsapp':
      return 'تم فتح واتساب — اضغط إرسال'
    case 'sms':
      return 'تم فتح الرسائل — اضغط إرسال'
    case 'telegram':
      return 'تم فتح Telegram — اختر محادثة ولي الأمر وأرسل'
    default:
      return 'تم فتح التطبيق'
  }
}
