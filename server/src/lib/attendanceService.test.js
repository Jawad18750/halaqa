import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getWeekStartSaturday,
  enumerateDates,
  formatWeeklyAttendanceLine,
  buildAttendanceOverviewReportMessage,
  buildWeeklyAttendanceGuardianMessage,
} from './attendanceService.js'

test('attendance week starts on Saturday', () => {
  assert.equal(getWeekStartSaturday('2026-06-03'), '2026-05-30')
  assert.equal(getWeekStartSaturday('2026-06-06'), '2026-06-06')
})

test('attendance date enumeration is inclusive', () => {
  assert.deepEqual(enumerateDates('2026-06-01', '2026-06-03'), [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
  ])
})

test('weekly attendance line uses study-day denominator', () => {
  assert.equal(
    formatWeeklyAttendanceLine({ presentCount: 4, studyDayCount: 5 }),
    '📋 الحضور هذا الأسبوع: 4 من 5 أيام دراسة'
  )
})

test('attendance report lists all missing today without plus-N truncation', () => {
  const students = Array.from({ length: 20 }, (_, i) => ({
    id: `s${i + 1}`,
    number: i + 1,
    name: `طالب ${i + 1}`,
    presentCount: 0,
    absentCount: 5,
    studyDayCount: 5,
    statuses: [{ date: '2026-06-03', status: 'absent' }],
  }))
  const text = buildAttendanceOverviewReportMessage(
    {
      from: '2026-05-30',
      to: '2026-06-05',
      today: '2026-06-03',
      students,
      totals: { presentToday: 0, presentTodayTotal: 20, weekRate: 0, studyDayCount: 5 },
    },
    { masjid_name: 'مسجد', sheikh_name: 'شيخ' }
  )
  assert.match(text, /غير مسجلين اليوم \(2026-06-03\) — 20:/)
  assert.doesNotMatch(text, /\+19/)
  assert.doesNotMatch(text, /غائبون في الفترة/)
  assert.equal((text.match(/^20\. /gm) || []).length, 1)
})

test('attendance report shows partial absence separately from today missing', () => {
  const text = buildAttendanceOverviewReportMessage({
    from: '2026-06-01',
    to: '2026-06-05',
    today: '2026-06-03',
    students: [
      {
        id: 'a',
        number: 1,
        name: 'أحمد',
        presentCount: 3,
        absentCount: 2,
        studyDayCount: 5,
        statuses: [{ date: '2026-06-03', status: 'present' }],
      },
      {
        id: 'b',
        number: 2,
        name: 'بلال',
        presentCount: 1,
        absentCount: 4,
        studyDayCount: 5,
        statuses: [{ date: '2026-06-03', status: 'absent' }],
      },
    ],
    totals: { presentToday: 1, presentTodayTotal: 2, weekRate: 40, studyDayCount: 5 },
  })
  assert.match(text, /حاضرون اليوم[\s\S]*1\. أحمد/)
  assert.match(text, /غير مسجلين اليوم[\s\S]*2\. بلال/)
  assert.match(text, /غياب جزئي[\s\S]*2\. بلال/)
})

test('weekly guardian message lists each study day present or absent', () => {
  const text = buildWeeklyAttendanceGuardianMessage({
    studentName: 'سيف الدين',
    summary: { from: '2026-05-30', to: '2026-06-05', presentCount: 0, absentCount: 5, studyDayCount: 5 },
    statuses: [
      { date: '2026-05-30', status: 'absent' },
      { date: '2026-05-31', status: 'absent' },
      { date: '2026-06-01', status: 'absent' },
      { date: '2026-06-02', status: 'absent' },
      { date: '2026-06-03', status: 'absent' },
      { date: '2026-06-04', status: 'closed' },
      { date: '2026-06-05', status: 'closed' },
    ],
    sheikhName: 'أحمد فتحي',
    masjidName: 'مسجد الشبش',
  })
  assert.match(text, /📅 التفصيل:/)
  assert.match(text, /❌.*— غائب/)
  assert.match(text, /⏸.*— عطلة/)
  assert.doesNotMatch(text, /الغياب: 5 يوم/)
})
