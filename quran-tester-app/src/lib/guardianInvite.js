import {
  buildHalaqaIntro,
  formatLinkCodeForDisplay,
  joinMessageBlocks,
  normalizeLinkCode,
} from './messageContext.js'

const BOT_USERNAME = 'Halaqa_Test_bot'

export const INVITE_CHANNELS = {
  whatsapp: { id: 'whatsapp', label: 'واتساب', icon: 'fa-brands fa-whatsapp' },
  telegram: { id: 'telegram', label: 'Telegram', icon: 'fa-brands fa-telegram' },
  sms: { id: 'sms', label: 'SMS', icon: 'fa-solid fa-comment-sms' },
}

export class InviteMessageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InviteMessageError'
  }
}

export function phoneToDigits(phoneE164) {
  return String(phoneE164 || '').replace(/\D/g, '')
}

export function validateInviteParams({ studentName, code, deepLink }) {
  const student = String(studentName || '').trim()
  if (!student) {
    return { ok: false, error: 'يجب تحديد اسم الطالب قبل إرسال الدعوة.' }
  }
  const formattedCode = code ? formatLinkCodeForDisplay(code) : null
  if (!formattedCode) {
    return { ok: false, error: 'رمز الربط غير متوفر — أعد إنشاء الدعوة.' }
  }
  if (!deepLink && !formattedCode) {
    return { ok: false, error: 'تعذر إنشاء دعوة كاملة — لا يوجد رابط أو رمز ربط.' }
  }
  return { ok: true, student, formattedCode }
}

function greetingLine(guardianName) {
  const name = String(guardianName || '').trim()
  if (name) return `السلام عليكم ورحمة الله وبركاته، ${name}`
  return 'السلام عليكم ورحمة الله وبركاته،'
}

function buildTelegramCopyInvite({ guardianName, studentName, deepLink, formattedCode, sheikhName, masjidName }) {
  const intro = buildHalaqaIntro({ sheikhName, masjidName, style: 'emoji' })
  const blocks = [
    greetingLine(guardianName),
    intro,
    [
      `يسرّنا دعوتكم لمتابعة نتائج اختبارات الطالب: ${studentName}`,
      'وذلك حتى تصلكم نتائجه في القرآن الكريم مباشرة بعد كل اختبار.',
    ],
  ]

  if (deepLink) {
    blocks.push(
      'سيتم إرسال النتائج عبر Telegram، والربط مطلوب مرة واحدة فقط.',
      [
        '✅ طريقة الربط:',
        '1. اضغطوا على الرابط أدناه.',
        '2. عند فتح Telegram، اضغطوا «Start» أو «ابدأ».',
        '3. بعد إتمام الربط، ستصلكم النتائج تلقائيًا.',
      ],
      [
        '🔗 رابط الربط:',
        deepLink,
      ],
      [
        'أو يمكنكم الربط يدويًا:',
        `افتحوا البوت @${BOT_USERNAME} وأرسلوا رمز الربط التالي:`,
        formattedCode,
      ],
    )
  } else {
    blocks.push(
      'سيتم إرسال النتائج عبر Telegram، والربط مطلوب مرة واحدة فقط.',
      [
        '✅ طريقة الربط:',
        `1. افتحوا البوت @${BOT_USERNAME} في Telegram.`,
        '2. أرسلوا رمز الربط التالي:',
        formattedCode,
        '3. بعد إتمام الربط، ستصلكم النتائج تلقائيًا.',
      ],
    )
  }

  blocks.push(
    'إذا واجهتم أي صعوبة في الربط، يرجى التواصل مع معلّم الحلقة.',
    'بارك الله فيكم، ونفع بكم.',
  )
  return joinMessageBlocks(blocks)
}

function buildWhatsAppInvite({ guardianName, studentName, deepLink, formattedCode, sheikhName, masjidName }) {
  const intro = buildHalaqaIntro({ sheikhName, masjidName, style: 'plain' })
  const blocks = [
    greetingLine(guardianName),
    intro,
    [
      `يسرّنا دعوتكم لمتابعة نتائج اختبارات الطالب: *${studentName}*`,
      'حتى تصلكم نتائجه في القرآن الكريم مباشرة بعد كل اختبار.',
    ],
  ]

  if (deepLink) {
    blocks.push(
      'سيتم استقبال النتائج عبر Telegram، والربط مطلوب مرة واحدة فقط.',
      [
        '*طريقة الربط:*',
        '1. اضغطوا على الرابط أدناه.',
        '2. عند فتح Telegram، اضغطوا «Start» أو «ابدأ».',
        '3. بعد إتمام الربط، ستصلكم النتائج تلقائيًا.',
      ],
      [
        '*رابط الربط:*',
        deepLink,
      ],
      [
        '*أو يمكنكم الربط يدويًا:*',
        `افتحوا البوت @${BOT_USERNAME} وأرسلوا رمز الربط التالي:`,
        `*${formattedCode}*`,
      ],
    )
  } else {
    blocks.push(
      'سيتم استقبال النتائج عبر Telegram، والربط مطلوب مرة واحدة فقط.',
      [
        '*طريقة الربط:*',
        `1. افتحوا البوت @${BOT_USERNAME} في Telegram.`,
        '2. أرسلوا رمز الربط التالي:',
        `*${formattedCode}*`,
        '3. بعد إتمام الربط، ستصلكم النتائج تلقائيًا.',
      ],
    )
  }

  blocks.push(
    'إذا واجهتم أي صعوبة في الربط، يرجى التواصل مع معلّم الحلقة.',
    'بارك الله فيكم، ونفع بكم.',
  )
  return joinMessageBlocks(blocks)
}

function buildSmsInvite({ studentName, deepLink, formattedCode }) {
  if (deepLink) {
    return [
      `السلام عليكم، لمتابعة نتائج الطالب ${studentName} في حلقة القرآن الكريم عبر Telegram، اضغط الرابط:`,
      deepLink,
      `أو أرسل الرمز ${formattedCode} إلى البوت:`,
      `@${BOT_USERNAME}`,
      'الربط مطلوب مرة واحدة فقط.',
    ].join('\n')
  }
  return [
    `السلام عليكم، لمتابعة نتائج الطالب ${studentName} في حلقة القرآن الكريم عبر Telegram، أرسل الرمز ${formattedCode} إلى البوت:`,
    `@${BOT_USERNAME}`,
    'الربط مطلوب مرة واحدة فقط.',
  ].join('\n')
}

export function buildInviteMessageForChannel(channel, params) {
  const validation = validateInviteParams(params)
  if (!validation.ok) throw new InviteMessageError(validation.error)

  const base = {
    guardianName: params.guardianName,
    studentName: validation.student,
    deepLink: params.deepLink || null,
    formattedCode: validation.formattedCode,
    sheikhName: params.sheikhName,
    masjidName: params.masjidName,
  }

  switch (channel) {
    case 'whatsapp':
      return buildWhatsAppInvite(base)
    case 'sms':
      return buildSmsInvite(base)
    case 'telegram':
    default:
      return buildTelegramCopyInvite(base)
  }
}

/** @deprecated use buildInviteMessageForChannel */
export function buildTelegramInviteMessage(params) {
  return buildInviteMessageForChannel('telegram', params)
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

export function buildTelegramShareUrl(deepLink, message) {
  if (!deepLink) return null
  const text = message || deepLink
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`
}

export function getInviteUrl(channel, { phoneE164, message, deepLink, inviteParams }) {
  let text = message
  if (!text && inviteParams) {
    try {
      text = buildInviteMessageForChannel(channel, inviteParams)
    } catch {
      return null
    }
  }

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
  try {
    if (inviteParams && !message) buildInviteMessageForChannel(channel, inviteParams)
  } catch (e) {
    return { channel, url: null, ok: false, error: e.message }
  }

  const url = getInviteUrl(channel, { phoneE164, message, deepLink, inviteParams })
  if (!url) return { channel, url: null, ok: false, error: 'تعذر فتح الدعوة' }

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
      return 'تم فتح واتساب، راجع الرسالة ثم أرسلها.'
    case 'sms':
      return 'تم فتح تطبيق الرسائل، راجع الرسالة ثم أرسلها.'
    case 'telegram':
      return 'تم فتح Telegram، اختر محادثة ولي الأمر ثم أرسل الرسالة.'
    default:
      return 'تم فتح التطبيق'
  }
}

export { formatLinkCodeForDisplay, normalizeLinkCode }
