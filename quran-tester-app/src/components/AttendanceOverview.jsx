import { useCallback, useEffect, useMemo, useState } from 'react'
import { attendance, notifications } from '../api'
import { formatRangeLabel, formatLatn } from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import DateRangePanel from './ui/DateRangePanel.jsx'
import StatTile from './ui/StatTile.jsx'
import EmptyState from './ui/EmptyState.jsx'
import Toast from './ui/Toast.jsx'

function pad2(n) { return String(n).padStart(2, '0') }

function tripoliDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function addDays(dateInput, days) {
  const d = new Date(`${dateInput}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function weekStartSaturday(dateInput = tripoliDateString()) {
  const d = new Date(`${dateInput}T12:00:00`)
  const diff = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dateLabel(date, short = false) {
  const d = new Date(`${date}T12:00:00`)
  if (short) {
    const weekday = d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short' })
    const day = d.getDate()
    const month = d.getMonth() + 1
    return `${weekday} ${day}/${month}`
  }
  return d.toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function statusCellLabel(status) {
  if (status.status === 'present') return '✓'
  if (status.status === 'closed') return 'عطلة'
  if (status.status === 'pending') return 'قادم'
  return '—'
}

function statusAriaLabel(status) {
  if (status.status === 'present') return 'حاضر'
  if (status.status === 'closed') return `عطلة${status.reason ? `: ${status.reason}` : ''}`
  if (status.status === 'pending') return 'لم يحن بعد'
  return 'غائب'
}

const LIST_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'absent_today', label: 'غائب اليوم' },
  { id: 'has_absent', label: 'لديهم غياب' },
  { id: 'full', label: 'حضور كامل' },
]

function filterStudents(students, query) {
  const q = query.trim().toLowerCase()
  if (!q) return students
  return students.filter(s => {
    const name = (s.name || '').toLowerCase()
    const num = String(s.number ?? '')
    return num.includes(q) || name.includes(q)
  })
}

function applyListFilter(students, filterId, today) {
  if (!students.length || filterId === 'all') return students
  if (filterId === 'has_absent') {
    return students.filter(s => s.absentCount > 0)
  }
  if (filterId === 'full') {
    return students.filter(s => s.studyDayCount > 0 && s.absentCount === 0)
  }
  if (filterId === 'absent_today' && today) {
    return students.filter(s =>
      s.statuses?.some(st => st.date === today && st.status === 'absent')
    )
  }
  return students
}

function AttendanceListToolbar({
  query,
  onQueryChange,
  listFilter,
  onListFilterChange,
  resultCount,
  totalCount,
  loading,
}) {
  const hasActiveFilter = listFilter !== 'all' || query.trim()

  return (
    <section className="attendance-overview-list-toolbar students-toolbar" aria-label="بحث وتصفية الطلاب">
      <div className="students-toolbar__row">
        <div className="students-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input
            className="students-search__input"
            placeholder="بحث بالاسم أو الرقم"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            aria-label="بحث عن طالب"
          />
          {query && (
            <button
              type="button"
              className="students-search__clear"
              aria-label="مسح البحث"
              onClick={() => onQueryChange('')}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn btn--ghost btn--sm attendance-overview-list-toolbar__reset"
            onClick={() => {
              onQueryChange('')
              onListFilterChange('all')
            }}
          >
            مسح
          </button>
        )}
      </div>

      <div
        className="students-filter attendance-overview-list-toolbar__filters"
        role="tablist"
        aria-label="تصفية حسب الحضور"
      >
        {LIST_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={listFilter === f.id}
            className={`students-filter__chip ${listFilter === f.id ? 'students-filter__chip--active' : ''}`}
            onClick={() => onListFilterChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="students-toolbar__meta">
        {loading
          ? 'جاري التحميل…'
          : resultCount === totalCount
            ? `${formatLatn(resultCount)} طالب`
            : `${formatLatn(resultCount)} من ${formatLatn(totalCount)} طالب`}
      </p>
    </section>
  )
}

function AttendanceMobileList({ students, today, emptyTitle, emptyMessage }) {
  if (!students.length) {
    return (
      <EmptyState
        icon="fa-clipboard-list"
        title={emptyTitle}
        message={emptyMessage}
      />
    )
  }

  return (
    <ul className="attendance-mobile-list">
      {students.map(student => (
        <li key={student.id} className="attendance-mobile-card">
          <header className="attendance-mobile-card__head">
            <span className="attendance-grid__student-num">{student.number}</span>
            <strong className="attendance-mobile-card__name">{student.name}</strong>
            <span className="attendance-mobile-card__ratio">
              {student.presentCount}/{student.studyDayCount}
            </span>
          </header>
          <ul className="attendance-mobile-card__days">
            {student.statuses
              .filter(status => status.status !== 'closed')
              .map(status => {
                const isToday = status.date === today
                return (
                  <li
                    key={`${student.id}:${status.date}`}
                    className={`attendance-mobile-day attendance-mobile-day--${status.status}${isToday ? ' attendance-mobile-day--today' : ''}`}
                  >
                    <span className="attendance-mobile-day__when">
                      {dateLabel(status.date, true)}
                      {isToday && <em className="attendance-mobile-day__tag">اليوم</em>}
                    </span>
                    <span className="attendance-mobile-day__state">{statusAriaLabel(status)}</span>
                  </li>
                )
              })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function AttendanceGridTable({ students, days, today, emptyTitle, emptyMessage }) {
  if (!students.length) {
    return (
      <EmptyState
        icon="fa-clipboard-list"
        title={emptyTitle}
        message={emptyMessage}
      />
    )
  }

  return (
    <section className="attendance-grid-wrap attendance-grid-wrap--desktop" aria-label="جدول الحضور">
      <p className="attendance-grid-scroll-hint meta">
        <i className="fa-solid fa-arrows-left-right" aria-hidden /> مرّر الجدول أفقيًا لعرض كل الأيام
      </p>
      <table className="attendance-grid">
        <thead>
          <tr>
            <th scope="col">الطالب</th>
            {(days || []).map(day => {
              const isToday = day.date === today
              return (
                <th
                  key={day.date}
                  scope="col"
                  className={isToday ? 'attendance-grid__day--today' : ''}
                >
                  {dateLabel(day.date)}
                  {isToday && <span className="attendance-grid__today-tag">اليوم</span>}
                </th>
              )
            })}
            <th scope="col">الحضور</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id}>
              <th scope="row">
                <span className="attendance-grid__student-num">{student.number}</span>
                <span className="attendance-grid__student-name">{student.name}</span>
              </th>
              {student.statuses.map(status => {
                const isToday = status.date === today
                return (
                  <td
                    key={`${student.id}:${status.date}`}
                    className={`attendance-grid__status attendance-grid__status--${status.status}${isToday ? ' attendance-grid__status--today-col' : ''}`}
                    aria-label={statusAriaLabel(status)}
                  >
                    <span aria-hidden>{statusCellLabel(status)}</span>
                  </td>
                )
              })}
              <td className="attendance-grid__summary">
                <span className="attendance-grid__ratio">{student.presentCount}/{student.studyDayCount}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function AttendanceOverview({ onBack }) {
  const initialFrom = weekStartSaturday()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(addDays(initialFrom, 6))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sendingWeekly, setSendingWeekly] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState('all')
  const [activeSection, setActiveSection] = useState('grid')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await attendance.overview(from, to))
    } catch (e) {
      setError(e.message || 'تعذر تحميل سجل الحضور')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const allStudents = data?.students || []
  const absentees = useMemo(() => (
    [...allStudents]
      .filter(student => student.absentCount > 0)
      .sort((a, b) => b.absentCount - a.absentCount || Number(a.number || 0) - Number(b.number || 0))
  ), [allStudents])

  const baseStudents = activeSection === 'grid' ? allStudents : absentees
  const gridStudents = useMemo(() => {
    const searched = filterStudents(baseStudents, query)
    return applyListFilter(searched, listFilter, data?.today)
  }, [baseStudents, query, listFilter, data?.today])

  const absentInPeriod = absentees.length
  const rangeSubtitle = data ? formatRangeLabel(data.from, data.to) : formatRangeLabel(from, to)

  function setCurrentWeek() {
    const start = weekStartSaturday()
    setFrom(start)
    setTo(addDays(start, 6))
  }

  async function sendWeekly() {
    setSendingWeekly(true)
    try {
      const result = await notifications.sendWeeklyAttendance(from, to)
      const sent = result.sent || 0
      const eligible = result.eligible ?? 0
      if (!sent) {
        setToast(
          eligible
            ? 'لم يُرسل شيء — تحقق من ربط Telegram'
            : 'لم يُرسل شيء — فعّل «ملخص حضور أسبوعي» لولي الأمر من ملف الطالب'
        )
      } else {
        setToast(`تم إرسال ${sent} ملخص لأولياء الأمور`)
      }
    } catch (e) {
      setToast(e.message || 'تعذر إرسال ملخص الحضور')
    } finally {
      setSendingWeekly(false)
    }
  }

  async function sendReportToMe() {
    setSendingReport(true)
    try {
      await notifications.sendAttendanceOverviewReport(from, to)
      setToast('تم إرسال سجل الحضور إلى Telegram')
    } catch (e) {
      setToast(e.message || 'تعذر إرسال التقرير')
    } finally {
      setSendingReport(false)
    }
  }

  const hasListConstraints = query.trim() || listFilter !== 'all'
  const gridEmptyTitle = hasListConstraints
    ? 'لا نتائج'
    : activeSection === 'grid'
      ? 'لا يوجد طلاب'
      : 'لا يوجد غياب'
  const gridEmptyMessage = hasListConstraints
    ? 'جرّب بحثًا أو تصفية مختلفة، أو اضغط «مسح».'
    : activeSection === 'grid'
      ? 'أضف طلابًا من قائمة الطلاب.'
      : 'جميع الطلاب حاضرون في أيام الدراسة لهذه الفترة.'

  return (
    <div className="attendance-overview-page">
      <PageHeader
        title="سجل الحضور"
        subtitle={rangeSubtitle}
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <i className="fa-solid fa-rotate" aria-hidden />
            {loading ? 'جاري التحديث…' : 'تحديث'}
          </button>
        )}
      />

      {error && <div className="alert alert--error">{error}</div>}

      <DateRangePanel
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onCurrentWeek={setCurrentWeek}
        actions={(
          <>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={sendReportToMe}
              disabled={sendingReport || loading || !data}
            >
              <i className="fa-brands fa-telegram" aria-hidden />
              إرسالي
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={sendWeekly}
              disabled={sendingWeekly || loading || !data}
            >
              <i className="fa-brands fa-telegram" aria-hidden />
              لأولياء الأمور
            </button>
          </>
        )}
        footer="ملخص أولياء الأمور يُرسل فقط عند تفعيل «ملخص حضور أسبوعي» في ملف الطالب."
      />

      <div className="attendance-overview-stats">
        <StatTile
          label="حضور اليوم"
          value={`${data?.totals?.presentToday ?? 0}/${data?.totals?.presentTodayTotal ?? 0}`}
          icon="fa-solid fa-clipboard-check"
          tone="ok"
        />
        <StatTile label="نسبة الفترة" value={`${data?.totals?.weekRate ?? 0}%`} icon="fa-solid fa-chart-line" />
        <StatTile label="أيام الدراسة" value={data?.totals?.studyDayCount ?? 0} icon="fa-solid fa-calendar-days" />
        <StatTile
          label="لديهم غياب"
          value={formatLatn(absentInPeriod)}
          icon="fa-solid fa-user-xmark"
          tone={absentInPeriod > 0 ? 'warn' : 'default'}
        />
      </div>

      <AttendanceListToolbar
        query={query}
        onQueryChange={setQuery}
        listFilter={listFilter}
        onListFilterChange={setListFilter}
        resultCount={gridStudents.length}
        totalCount={baseStudents.length}
        loading={loading}
      />

      <div className="attendance-tabs attendance-overview-tabs" role="tablist" aria-label="عرض سجل الحضور">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'grid'}
          className={`attendance-tab ${activeSection === 'grid' ? 'attendance-tab--active' : ''}`}
          onClick={() => setActiveSection('grid')}
        >
          السجل
          <span className="attendance-tab__badge">{formatLatn(allStudents.length)}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'absent'}
          className={`attendance-tab ${activeSection === 'absent' ? 'attendance-tab--active' : ''}`}
          onClick={() => setActiveSection('absent')}
        >
          غائبون
          <span className={`attendance-tab__badge ${absentInPeriod ? 'attendance-tab__badge--warn' : ''}`}>
            {formatLatn(absentInPeriod)}
          </span>
        </button>
      </div>

      <div className={`attendance-overview-grid ${loading && data ? 'attendance-overview-grid--loading' : ''}`}>
        {loading && !data ? (
          <div className="loading">جاري تحميل سجل الحضور…</div>
        ) : (
          <>
            <div className="attendance-overview-mobile">
              <AttendanceMobileList
                students={gridStudents}
                today={data?.today}
                emptyTitle={gridEmptyTitle}
                emptyMessage={gridEmptyMessage}
              />
            </div>
            <AttendanceGridTable
              students={gridStudents}
              days={data?.days}
              today={data?.today}
              emptyTitle={gridEmptyTitle}
              emptyMessage={gridEmptyMessage}
            />
          </>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}
