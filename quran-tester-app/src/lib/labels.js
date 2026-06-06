export const JUZ_NAMES = [
  'الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا',
  'يعتذرون', 'وما من دابة', 'وما أبرئ نفسي', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب', 'قد أفلح', 'وقال الذين', 'أمن خلق',
  'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم السجدة', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم',
]

export const QUARTER_LABELS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع']
export const HALF_LABELS = ['النصف الأول', 'النصف الثاني']

export const VIEW_TITLES = {
  dashboard: 'الرئيسية',
  students: 'الطلاب',
  test: 'اختبار',
  studentHistory: 'سجل الطالب',
  weekly: 'نظرة زمنية',
  leaderboard: 'لوحة الصدارة',
  freestyle: 'الوضع الحر',
  about: 'عن التطبيق',
  privacy: 'الخصوصية',
  backup: 'النسخ الاحتياطي',
  guardians: 'أولياء الأمور',
  broadcast: 'رسائل Telegram',
  messageLog: 'سجل الرسائل',
  attendanceLog: 'سجل الحضور',
  addStudent: 'إضافة طالب',
  reset: 'إعادة تعيين كلمة المرور',
}

export function buildNaqzaLabels(thumuns) {
  const labels = []
  for (let n = 1; n <= 20; n++) {
    const first = (thumuns || []).filter(t => t.naqza === n).sort((a, b) => a.id - b.id)[0]
    labels.push(first?.name || `النقزة ${n}`)
  }
  return labels
}

export function formatNaqza(n, thumuns, labels) {
  const num = Number(n)
  if (!num) return String(n ?? '—')
  const name = labels?.[num - 1] || (thumuns?.length
    ? thumuns.filter(t => t.naqza === num).sort((a, b) => a.id - b.id)[0]?.name
    : null) || `النقزة ${num}`
  return `${num} - ${name}`
}

export function formatJuz(n, names = JUZ_NAMES) {
  const num = Number(n)
  if (!num) return String(n ?? '—')
  const name = names[num - 1] || `الجزء ${num}`
  return `${num} - ${name}`
}

export function juzName(n, names = JUZ_NAMES) {
  const num = Number(n || 0)
  if (!num) return ''
  return names[num - 1] || `الجزء ${num}`
}

export function naqzaName(n, thumuns) {
  const num = Number(n || 0)
  if (!num || !thumuns?.length) return ''
  const first = thumuns.filter(t => t.naqza === num).sort((a, b) => a.id - b.id)[0]
  return first?.name || ''
}

export function getFiveHizbGroup(hizb) {
  const num = Number(hizb || 0)
  return num > 0 ? Math.floor((num - 1) / 5) + 1 : null
}

export function fiveHizbLabel(k) {
  const n = Number(k)
  if (!n) return ''
  const start = (n - 1) * 5 + 1
  const end = n * 5
  return `الأحزاب ${start}–${end}`
}

export function filterThumuns(thumuns, { mode, naqza, juz, fiveHizb, quarter, half }) {
  if (!thumuns?.length) return []
  if (mode === 'juz' && juz) return thumuns.filter(t => t.juz === Number(juz))
  if (mode === 'five_hizb' && fiveHizb) return thumuns.filter(t => getFiveHizbGroup(t.hizb) === Number(fiveHizb))
  if (mode === 'quarter' && quarter) return thumuns.filter(t => Number(t.quranQuarter || Math.floor((t.id - 1) / 120) + 1) === Number(quarter))
  if (mode === 'half' && half) return thumuns.filter(t => Number(t.quranHalf || Math.floor((t.id - 1) / 240) + 1) === Number(half))
  if (mode === 'full') return thumuns
  return thumuns.filter(t => t.naqza === Number(naqza))
}

export function modeLabel(mode) {
  switch (mode) {
    case 'naqza': return 'النقزة'
    case 'juz': return 'الجزء'
    case 'five_hizb': return 'خمسة أحزاب'
    case 'quarter': return 'ربع القرآن'
    case 'half': return 'نصف القرآن'
    case 'full': return 'القرآن كامل'
    default: return mode ? String(mode) : '—'
  }
}

export function resultLabel(passed) {
  return passed ? 'نجح' : 'فشل'
}

export function gradeLabel(score) {
  const s = Number(score || 0)
  if (s >= 90) return 'ممتاز'
  if (s >= 80) return 'جيد جدًا'
  if (s >= 70) return 'جيد'
  if (s >= 60) return 'مقبول'
  return 'راسب'
}

export function dayName(code) {
  return ({
    sun: 'الأحد', mon: 'الاثنين', tue: 'الثلاثاء', wed: 'الأربعاء',
    thu: 'الخميس', fri: 'الجمعة', sat: 'السبت',
  })[code] || ''
}

export function formatAttemptDate(row) {
  return row?.attempt_at || row?.created_at || null
}

export function formatLocaleDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ar-EG-u-nu-latn')
  } catch {
    return '—'
  }
}

export function formatMemorizationFromThumun(thumunId, thumuns) {
  const id = Number(thumunId)
  if (!id) return ''
  const t = (thumuns || []).find(x => Number(x.id) === id)
  if (!t) return `ثمن ${id}`
  const surah = t.surah || ''
  const name = t.name || ''
  if (surah && name) return `سورة ${surah} — ثمن ${id} (${name})`
  if (surah) return `سورة ${surah} — ثمن ${id}`
  return name ? `ثمن ${id} — ${name}` : `ثمن ${id}`
}

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
}

export function formatQalamOrdinal(count) {
  const n = Number(count ?? 1)
  if (!Number.isFinite(n) || n < 1) return 'الأول'
  return QALAM_ORDINALS[n] || String(n)
}

export function formatQalamLabel(count) {
  return `القلم ${formatQalamOrdinal(count)}`
}

export function formatMemorizationPosition(student, thumuns) {
  if (!student) return ''
  if (student.memorization_thumun_id != null && student.memorization_thumun_id !== '') {
    return formatMemorizationFromThumun(student.memorization_thumun_id, thumuns)
  }
  if (student.memorization_surah) return `سورة ${student.memorization_surah}`
  return ''
}

export function formatThumunId(id, thumuns) {
  const t = (thumuns || []).find(x => x.id === Number(id))
  if (!t) return String(id ?? '—')
  return `${t.id} - ${t.name}`
}

export function computeScore(fatha, taradud) {
  const passed = fatha < 4
  const fathaPenaltyTier = fatha >= 3 ? 30 : fatha === 2 ? 20 : fatha === 1 ? 10 : 0
  const hesitationPenalty = Math.min(10, Math.max(0, taradud - 3))
  const score = passed
    ? Math.max(60, Math.min(100, 100 - (fathaPenaltyTier + hesitationPenalty)))
    : Math.max(0, Math.min(59, 59 - (Math.max(0, fatha - 4) * 5) - Math.min(20, taradud)))
  return { passed, score, grade: gradeLabel(score) }
}

export function emptyFilterHint(mode, { juz, fiveHizb, quarter, half } = {}) {
  if (mode === 'juz' && !juz) return 'اختر الجزء أولاً'
  if (mode === 'five_hizb' && !fiveHizb) return 'اختر مجموعة الأحزاب أولاً'
  if (mode === 'quarter' && !quarter) return 'اختر الربع أولاً'
  if (mode === 'half' && !half) return 'اختر النصف أولاً'
  return 'لا توجد أثمان متاحة لهذا الاختيار'
}

export function rankLabel(rank) {
  const n = Number(rank)
  if (n === 1) return 'المركز 1'
  if (n === 2) return 'المركز 2'
  if (n === 3) return 'المركز 3'
  return `المركز ${n}`
}

export function toDateOnly(v) {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
    if (v.includes('T')) return v.split('T')[0]
  }
  try {
    const d = new Date(v)
    if (!isNaN(d)) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
  } catch {}
  return ''
}

export function formatRangeLabel(from, to) {
  if (!from && !to) return 'اختر الفترة'
  try {
    const opts = { day: 'numeric', month: 'short' }
    const f = from ? new Date(`${from}T12:00:00`).toLocaleDateString('ar-EG-u-nu-latn', opts) : '—'
    const t = to ? new Date(`${to}T12:00:00`).toLocaleDateString('ar-EG-u-nu-latn', opts) : '—'
    return `${f} — ${t}`
  } catch {
    return `${from} — ${to}`
  }
}

export function formatDateLabel(value) {
  if (!value) return '—'
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      numberingSystem: 'latn',
    })
  } catch {
    return value
  }
}

export function formatLatn(n, opts = {}) {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('ar-EG-u-nu-latn', opts) : String(n)
}

export function formatLatn1(n) {
  return formatLatn(n, { maximumFractionDigits: 1 })
}
