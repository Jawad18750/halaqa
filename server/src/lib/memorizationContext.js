import { loadThumunData } from './thumunData.js'

/** Masculine ordinals for قلم (full-Quran completion count) */
const QALAM_ORDINALS = {
  1: 'الأول',
  2: 'الثاني',
  3: 'الثالث',
  4: 'الرابع',
  5: 'الخامس',
  6: 'السادس',
  7: 'السابع',
  8: 'الثامن',
  9: 'التاسع',
  10: 'العاشر',
  11: 'الحادي عشر',
  12: 'الثاني عشر',
  13: 'الثالث عشر',
  14: 'الرابع عشر',
  15: 'الخامس عشر',
  16: 'السادس عشر',
  17: 'السابع عشر',
  18: 'الثامن عشر',
  19: 'التاسع عشر',
  20: 'العشرون',
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

export function formatMemorizationSurah(surah) {
  const name = String(surah || '').trim()
  if (!name) return null
  return `سورة ${name}`
}

/** Lines for guardian messages from memorization_thumun_id or memorization_surah */
export function formatMemorizationLines(student, thumunsInput) {
  const thumunId = student?.memorization_thumun_id
  const surahOnly = student?.memorization_surah
  if ((thumunId == null || thumunId === '') && !surahOnly) return []

  let thumuns = thumunsInput
  if (!thumuns) {
    try {
      thumuns = loadThumunData().list || []
    } catch {
      thumuns = []
    }
  }

  if (thumunId != null && thumunId !== '') {
    const position = formatMemorizationThumun(thumunId, thumuns)
    if (position) return [`مستوى الحفظ الحالي: ${position}`]
  }

  const surahLine = formatMemorizationSurah(surahOnly)
  if (surahLine) return [`مستوى الحفظ الحالي: ${surahLine}`]

  return []
}

export function formatQalamOrdinal(count) {
  const n = Number(count ?? 1)
  if (!Number.isFinite(n) || n < 1) return ''
  return QALAM_ORDINALS[n] || String(n)
}

/** Student-level قلم: times the full Quran has been completed (default 1). */
export function formatQalamLine(student) {
  const n = Number(student?.qalam_count ?? 1)
  if (!Number.isFinite(n) || n < 1) return ''
  const ordinal = formatQalamOrdinal(n)
  return `القلم: ${ordinal}`
}

export function formatQalamLineLatin(n) {
  const num = Number(n ?? 1)
  if (!Number.isFinite(num) || num < 1) return ''
  const ordinal = formatQalamOrdinal(num)
  return `القلم: ${ordinal}`
}
