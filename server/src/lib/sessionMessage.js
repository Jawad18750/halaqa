import { getThumunById, loadThumunData } from './thumunData.js'

import { buildHalaqaSignature } from './messageContext.js'

function resultLabel(passed) {
  return passed ? '✅ نجح' : '❌ لم ينجح'
}

function gradeLabel(score) {
  const s = Number(score || 0)
  if (s >= 90) return '🌟 ممتاز'
  if (s >= 80) return '👍 جيد جدًا'
  if (s >= 70) return '🙂 جيد'
  if (s >= 60) return '📘 مقبول'
  return '📕 يحتاج متابعة'
}

function modeLabel(mode) {
  switch (mode) {
    case 'naqza': return 'نقزة'
    case 'juz': return 'جزء'
    case 'five_hizb': return 'مجموعة أحزاب'
    case 'quarter': return 'ربع القرآن'
    case 'half': return 'نصف القرآن'
    case 'full': return 'القرآن كامل'
    default: return mode ? String(mode) : '—'
  }
}

function formatNaqza(n, thumuns) {
  const num = Number(n)
  if (!num) return String(n ?? '—')
  const first = (thumuns || []).filter(t => t.naqza === num).sort((a, b) => a.id - b.id)[0]
  const name = first?.name || `النقزة ${num}`
  return `${num} - ${name}`
}

function formatThumunId(id, thumuns) {
  const t = (thumuns || []).find(x => x.id === Number(id))
  if (!t) return String(id ?? '—')
  return `${t.id} - ${t.name}`
}

function formatLocaleDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ar-EG-u-nu-latn')
  } catch {
    return '—'
  }
}

export function buildSessionResultMessage({ studentName, session, sheikhName, masjidName }) {
  let thumuns = []
  try {
    thumuns = loadThumunData().list || []
  } catch {
    thumuns = []
  }

  const passed = session.passed
  const score = session.score
  const grade = gradeLabel(score)
  const thumun = formatThumunId(session.thumun_id, thumuns)
  const naqzaVal = session.naqza ?? session.selected_naqza
  const naqza = formatNaqza(naqzaVal, thumuns)
  const date = formatLocaleDateTime(session.attempt_at || session.created_at)
  const mode = modeLabel(session.mode)

  const encouragement = passed
    ? `🤲 بارك الله في ${studentName} — جزاكم الله خيراً.`
    : `🤲 نسأل الله التوفيق — شجّعوا ${studentName} على المراجعة.`

  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const autoLine = halaqaFooter
    ? '💡 رسالة تلقائية من حلقة الاختبار — لا حاجة للرد.'
    : '💡 هذه رسالة تلقائية من حلقة الاختبار — لا حاجة للرد.'

  const lines = [
    '📋 نتيجة اختبار القرآن',
    '━━━━━━━━━━━━━━',
    '',
    `👤 الطالب: ${studentName}`,
    `📊 النتيجة: ${resultLabel(passed)} — ${score} (${grade})`,
    '',
    `📖 الوضع: ${mode}`,
    `📜 الثمن: ${thumun}`,
    `🔢 النقزة: ${naqza}`,
    `📅 التاريخ: ${date}`,
    '',
    autoLine,
  ]

  if (halaqaFooter) {
    lines.push(halaqaFooter)
    lines.push('')
  }

  lines.push(encouragement)

  return lines.join('\n')
}
