import { loadThumunData } from './thumunData.js'
import { buildHalaqaSignature, formatArabicDateTime, joinMessageBlocks } from './messageContext.js'

const AUTO_DISCLAIMER = 'هذه رسالة تلقائية لمتابعة مستوى الطالب، ولا يلزم الرد عليها.'

function gradeLabel(score) {
  const s = Number(score || 0)
  if (s >= 90) return 'ممتاز'
  if (s >= 80) return 'جيد جدًا'
  if (s >= 70) return 'جيد'
  if (s >= 60) return 'مقبول'
  return 'يحتاج إلى متابعة'
}

function modeLabel(mode) {
  switch (mode) {
    case 'naqza': return 'نقزة'
    case 'juz': return 'جزء'
    case 'five_hizb': return 'مجموعة أحزاب'
    case 'quarter': return 'ربع القرآن'
    case 'half': return 'نصف القرآن'
    case 'full': return 'القرآن كامل'
    default: return mode ? String(mode) : ''
  }
}

function formatNaqzaLabel(n, thumuns) {
  const num = Number(n)
  if (!num) return ''
  const first = (thumuns || []).filter(t => t.naqza === num).sort((a, b) => a.id - b.id)[0]
  const name = first?.name || `النقزة ${num}`
  return `${num} - ${name}`
}

function formatThumunLabel(id, thumuns) {
  const t = (thumuns || []).find(x => x.id === Number(id))
  if (!t) return ''
  return `${t.id} - ${t.name}`
}

function buildTestDetails(session, thumuns) {
  const mode = modeLabel(session.mode)
  const thumn = formatThumunLabel(session.thumun_id, thumuns)
  const naqzaVal = session.naqza ?? session.selected_naqza
  const naqza = formatNaqzaLabel(naqzaVal, thumuns)

  if (mode && thumn && naqza) {
    if (thumn === naqza) {
      return [
        '📖 تفاصيل الاختبار:',
        `نوع الاختبار: ${mode}`,
        `النقزة: ${naqza}`,
      ].join('\n')
    }
    return [
      '📖 تفاصيل الاختبار:',
      `نوع الاختبار: ${mode}`,
      `الموضع: ${thumn}`,
      `النقزة: ${naqza}`,
    ].join('\n')
  }
  if (mode && thumn) {
    return [
      '📖 تفاصيل الاختبار:',
      `نوع الاختبار: ${mode}`,
      `الموضع: ${thumn}`,
    ].join('\n')
  }
  const location = thumn || naqza || mode
  if (location) {
    return `📖 موضع الاختبار: ${location}`
  }
  return ''
}

export function buildSessionResultMessage({ studentName, session, sheikhName, masjidName }) {
  let thumuns = []
  try {
    thumuns = loadThumunData().list || []
  } catch {
    thumuns = []
  }

  const passed = Boolean(session.passed)
  const score = Number(session.score || 0)
  const grade = gradeLabel(score)
  const testDetails = buildTestDetails(session, thumuns)
  const date = formatArabicDateTime(session.attempt_at || session.created_at)
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })

  const resultLine = passed
    ? 'النتيجة: ✅ أتمّ الاختبار بنجاح'
    : 'النتيجة: 📖 يحتاج إلى مراجعة إضافية'

  const closing = passed
    ? `🤲 بارك الله في ${studentName}، وزاده إتقانًا وثباتًا.`
    : `🤲 نسأل الله أن يوفّق ${studentName}، ونوصي بتشجيعه على المراجعة والاستمرار.`

  return joinMessageBlocks([
    '📋 نتيجة اختبار القرآن الكريم',
    [
      `الطالب: ${studentName}`,
      resultLine,
      `الدرجة: ${score} — ${grade}`,
    ],
    testDetails,
    `التاريخ: ${date}`,
    AUTO_DISCLAIMER,
    halaqaFooter,
    closing,
  ])
}
