import { pool } from './db.js'
import { loadThumunData } from './thumunData.js'
import { formatMemorizationLines } from './memorizationContext.js'
import {
  getCalendarSettings,
  getCalendarStatus,
  todayInHalaqaTimeZone,
  weekdayInHalaqaTimeZone,
} from './halaqaCalendar.js'

const DAY_LABEL_AR = {
  sun: 'الأحد',
  mon: 'الإثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
  sat: 'السبت',
}

function pad2(n) { return String(n).padStart(2, '0') }

export function formatLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function normalizeDate(input, fallback = todayInHalaqaTimeZone()) {
  const value = String(input || fallback).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

export function getWeekStartSaturday(dateInput = todayInHalaqaTimeZone()) {
  const date = normalizeDate(dateInput)
  const d = new Date(`${date}T12:00:00`)
  const diff = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - diff)
  return formatLocalDate(d)
}

export function addDays(dateInput, days) {
  const d = new Date(`${normalizeDate(dateInput)}T12:00:00`)
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

export function enumerateDates(fromInput, toInput) {
  const from = normalizeDate(fromInput)
  const to = normalizeDate(toInput, from)
  const rows = []
  let cursor = from
  while (cursor <= to && rows.length < 370) {
    rows.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return rows
}

export async function buildAttendanceOverview(userId, { from, to } = {}) {
  const today = todayInHalaqaTimeZone()
  const rangeFrom = normalizeDate(from, getWeekStartSaturday(today))
  const rangeTo = normalizeDate(to, addDays(rangeFrom, 6))
  const dates = enumerateDates(rangeFrom, rangeTo)
  const settings = await getCalendarSettings(userId)
  const days = dates.map(date => ({ date, ...getCalendarStatus(date, settings) }))
  const studyDays = days.filter(day => !day.closed)
  const countedStudyDays = studyDays.filter(day => day.date <= today)

  const [studentsQ, recordsQ] = await Promise.all([
    pool.query(
      `select id, number, name, memorization_thumun_id, memorization_surah
       from students where user_id=$1 order by number asc`,
      [userId]
    ),
    pool.query(
      `select ar.id, ar.student_id, ar.attendance_date::text as attendance_date, ar.recorded_at, ar.source
       from attendance_records ar
       join students st on st.id = ar.student_id
       where st.user_id=$1
         and ar.attendance_date >= $2::date
         and ar.attendance_date <= $3::date`,
      [userId, rangeFrom, rangeTo]
    ),
  ])

  const recordMap = new Map()
  for (const row of recordsQ.rows) {
    recordMap.set(`${row.student_id}:${row.attendance_date}`, row)
  }

  const students = studentsQ.rows.map(student => {
    let presentCount = 0
    let absentCount = 0
    const statuses = days.map(day => {
      if (day.closed) return { date: day.date, status: 'closed', reason: day.reasons?.[0] || day.builtInHoliday?.name || '' }
      const record = recordMap.get(`${student.id}:${day.date}`)
      if (record) {
        presentCount++
        return { date: day.date, status: 'present', recordId: record.id, source: record.source }
      }
      if (day.date > today) return { date: day.date, status: 'pending' }
      absentCount++
      return { date: day.date, status: 'absent' }
    })
    return {
      id: student.id,
      number: student.number,
      name: student.name,
      memorization_thumun_id: student.memorization_thumun_id,
      memorization_surah: student.memorization_surah,
      presentCount,
      absentCount,
      studyDayCount: countedStudyDays.length,
      statuses,
    }
  })

  const todayRecords = today >= rangeFrom && today <= rangeTo
    ? recordsQ.rows.filter(row => row.attendance_date === today)
    : (await pool.query(
        `select ar.id
         from attendance_records ar
         join students st on st.id = ar.student_id
         where st.user_id=$1 and ar.attendance_date=$2::date`,
        [userId, today]
      )).rows

  const possibleAttendances = students.length * countedStudyDays.length
  const presentTotal = students.reduce((sum, student) => sum + student.presentCount, 0)

  return {
    from: rangeFrom,
    to: rangeTo,
    today,
    days,
    students,
    totals: {
      studentCount: students.length,
      studyDayCount: countedStudyDays.length,
      presentTotal,
      possibleAttendances,
      presentToday: todayRecords.length,
      presentTodayTotal: students.length,
      weekRate: possibleAttendances ? Math.round((presentTotal / possibleAttendances) * 100) : 0,
    },
  }
}

export async function getStudentWeeklyAttendanceSummary(userId, studentId, dateInput = todayInHalaqaTimeZone()) {
  const weekStart = getWeekStartSaturday(dateInput)
  const overview = await buildAttendanceOverview(userId, { from: weekStart, to: addDays(weekStart, 6) })
  const student = overview.students.find(row => row.id === studentId)
  return {
    from: overview.from,
    to: overview.to,
    presentCount: student?.presentCount || 0,
    studyDayCount: student?.studyDayCount || overview.totals.studyDayCount || 0,
    absentCount: student?.absentCount || 0,
  }
}

export function formatWeeklyAttendanceLine(summary) {
  return `📋 الحضور هذا الأسبوع: ${summary.presentCount} من ${summary.studyDayCount} أيام دراسة`
}

function formatShortDate(date) {
  const [, m, d] = String(date || '').split('-')
  if (!m || !d) return date
  return `${Number(d)}/${Number(m)}`
}

/** Day-by-day lines for guardian weekly Telegram (study days only). */
export function formatWeeklyAttendanceDayDetails(statuses = []) {
  const lines = []
  for (const row of statuses) {
    if (row.status === 'closed') {
      const code = weekdayInHalaqaTimeZone(row.date)
      const label = DAY_LABEL_AR[code] || code
      lines.push(`⏸ ${label} ${formatShortDate(row.date)} — عطلة`)
      continue
    }
    if (row.status === 'pending') continue
    const code = weekdayInHalaqaTimeZone(row.date)
    const label = DAY_LABEL_AR[code] || code
    const when = `${label} ${formatShortDate(row.date)}`
    if (row.status === 'present') {
      lines.push(`✅ ${when} — حاضر`)
    } else if (row.status === 'absent') {
      lines.push(`❌ ${when} — غائب`)
    }
  }
  return lines
}

export function buildWeeklyAttendanceGuardianMessage({
  studentName,
  student,
  summary,
  statuses = [],
  sheikhName,
  masjidName,
}) {
  const footer = [masjidName ? `🕌 ${masjidName}` : '', sheikhName ? `بإشراف الشيخ ${sheikhName}` : '']
    .filter(Boolean)
    .join('\n')
  const dayLines = formatWeeklyAttendanceDayDetails(statuses)
  let thumuns = []
  try {
    thumuns = loadThumunData().list || []
  } catch {
    thumuns = []
  }
  const memorizationLines = formatMemorizationLines(student || {}, thumuns)
  const blocks = [
    '📋 ملخص حضور الأسبوع',
    `الطالب: ${studentName}`,
    ...memorizationLines,
    `من ${summary.from} إلى ${summary.to}`,
    formatWeeklyAttendanceLine(summary),
    '',
    '📅 التفصيل:',
    ...(dayLines.length ? dayLines : ['لا توجد أيام دراسة في هذه الفترة.']),
  ]
  if (footer) blocks.push('', footer)
  return blocks.join('\n')
}

const TELEGRAM_REPORT_MAX = 4096

function sortByNumber(students) {
  return [...students].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
}

function appendLines(lines, nextLines, maxLen = TELEGRAM_REPORT_MAX) {
  for (const line of nextLines) {
    const candidate = [...lines, line].join('\n')
    if (candidate.length > maxLen) return false
    lines.push(line)
  }
  return true
}

/** Full attendance register summary for sheikh Telegram report. */
export function buildAttendanceOverviewReportMessage(overview, { sheikh_name, masjid_name } = {}) {
  const t = overview?.totals || {}
  const students = overview?.students || []
  const lines = [
    '📋 سجل الحضور',
    `من ${overview.from} إلى ${overview.to}`,
    `حضور اليوم: ${t.presentToday ?? 0}/${t.presentTodayTotal ?? 0}`,
    `نسبة الأسبوع: ${t.weekRate ?? 0}%`,
    `أيام الدراسة: ${t.studyDayCount ?? 0}`,
  ]
  if (masjid_name) lines.push(`🕌 ${masjid_name}`)
  if (sheikh_name) lines.push(`👤 ${sheikh_name}`)

  const presentToday = sortByNumber(
    students.filter(s => s.statuses?.find(st => st.date === overview.today)?.status === 'present')
  )
  const missingToday = sortByNumber(
    students.filter(s => s.statuses?.find(st => st.date === overview.today)?.status === 'absent')
  )
  const partialAbsent = sortByNumber(
    students.filter(s => s.absentCount > 0 && s.presentCount > 0)
  )

  if (presentToday.length) {
    lines.push('', `حاضرون اليوم (${overview.today}) — ${presentToday.length}:`)
    if (!appendLines(lines, presentToday.map(s => `${s.number}. ${s.name}`))) {
      lines.push(`… التفاصيل الكاملة في التطبيق`)
    }
  }

  if (missingToday.length) {
    lines.push('', `غير مسجلين اليوم (${overview.today}) — ${missingToday.length}:`)
    if (!appendLines(lines, missingToday.map(s => `${s.number}. ${s.name}`))) {
      const listed = lines.filter(l => /^\d+\.\s/.test(l)).length
      const rest = missingToday.length - listed
      if (rest > 0) lines.push(`… و${rest} طالبًا آخر (افتح سجل الحضور في التطبيق)`)
    }
  }

  if (partialAbsent.length) {
    lines.push('', `غياب جزئي خلال الفترة — ${partialAbsent.length}:`)
    const partialLines = partialAbsent.map(
      s => `${s.number}. ${s.name} — حضر ${s.presentCount} من ${s.studyDayCount}`
    )
    if (!appendLines(lines, partialLines)) {
      lines.push(`… التفاصيل الكاملة في التطبيق`)
    }
  }

  if (!presentToday.length && !missingToday.length && !partialAbsent.length) {
    lines.push('', 'لا يوجد غياب مسجل في أيام الدراسة لهذه الفترة.')
  }

  return lines.join('\n')
}
