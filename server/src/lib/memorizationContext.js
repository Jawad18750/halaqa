import { loadThumunData } from './thumunData.js'

const QALAM_ORDINALS = {
  1: 'الأولى',
  2: 'الثانية',
  3: 'الثالثة',
  4: 'الرابعة',
  5: 'الخامسة',
  6: 'السادسة',
  7: 'السابعة',
  8: 'الثامنة',
  9: 'التاسعة',
}

export function getThumunById(thumunId, thumuns) {
  const id = Number(thumunId)
  if (!id) return null
  const list = thumuns || []
  return list.find(t => Number(t.id) === id) || null
}

export function formatMemorizationThumun(thumunId, thumuns) {
  const t = getThumunById(thumunId, thumuns)
  if (!t) return null
  const surah = t.surah || ''
  const num = Number(t.id)
  const name = t.name || ''
  if (surah && name) return `سورة ${surah} — ثمن ${num}${name ? ` (${name})` : ''}`
  if (surah) return `سورة ${surah} — ثمن ${num}`
  return name ? `ثمن ${num} — ${name}` : `ثمن ${num}`
}

/** Lines for guardian messages from student.memorization_thumun_id */
export function formatMemorizationLines(student, thumunsInput) {
  const thumunId = student?.memorization_thumun_id
  if (thumunId == null || thumunId === '') return []
  let thumuns = thumunsInput
  if (!thumuns) {
    try {
      thumuns = loadThumunData().list || []
    } catch {
      thumuns = []
    }
  }
  const position = formatMemorizationThumun(thumunId, thumuns)
  if (!position) return []
  return [
    `مستوى الحفظ الحالي: ${position}`,
  ]
}

export function formatQalamLine(session) {
  const n = Number(session?.test_try_number || 1)
  if (!Number.isFinite(n) || n < 1) return ''
  const ordinal = QALAM_ORDINALS[n]
  if (ordinal) return `القلم: المحاولة ${ordinal}`
  return `القلم: المحاولة ${n}`
}

export function formatQalamLineLatin(n) {
  const num = Number(n || 1)
  if (!Number.isFinite(num) || num < 1) return ''
  const ordinal = QALAM_ORDINALS[num]
  if (ordinal) return `القلم: المحاولة ${ordinal}`
  return `القلم: المحاولة ${num}`
}
