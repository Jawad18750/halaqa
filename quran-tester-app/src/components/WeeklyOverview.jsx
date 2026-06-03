import { useEffect, useMemo, useState, useCallback } from 'react'
import { sessions } from '../api'
import {
  modeLabel,
  resultLabel,
  dayName,
  formatThumunId,
  formatNaqza,
  formatLocaleDateTime,
  formatAttemptDate,
  toDateOnly,
  formatRangeLabel,
  formatLatn,
  formatLatn1,
} from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import DateRangePanel from './ui/DateRangePanel.jsx'
import EmptyState from './ui/EmptyState.jsx'
import SessionCard from './ui/SessionCard.jsx'
import StatTile from './ui/StatTile.jsx'

function formatNaqzaForThumun(id, thumuns) {
  const t = thumuns.find(x => x.id === Number(id))
  if (!t || !t.naqza) return ''
  return formatNaqza(t.naqza, thumuns)
}

const RESULT_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'pass', label: 'نجح' },
  { id: 'fail', label: 'رسب' },
]

function WeeklyOverviewToolbar({
  query,
  onQueryChange,
  resultFilter,
  onResultFilterChange,
  onPdf,
  onExcel,
  exportsDisabled,
  resultCount,
  totalCount,
  loading,
}) {
  const hasActive = query.trim() || resultFilter !== 'all'

  return (
    <section className="weekly-overview-toolbar students-toolbar" aria-label="بحث وتصفية المحاولات">
      <div className="students-toolbar__row">
        <div className="students-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input
            className="students-search__input"
            placeholder="بحث بالاسم أو رقم الطالب"
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
        {hasActive && (
          <button
            type="button"
            className="btn btn--ghost btn--sm weekly-overview-toolbar__reset"
            onClick={() => {
              onQueryChange('')
              onResultFilterChange('all')
            }}
          >
            مسح
          </button>
        )}
      </div>

      <div className="students-filter weekly-overview-toolbar__filters" role="tablist" aria-label="تصفية النتيجة">
        {RESULT_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={resultFilter === f.id}
            className={`students-filter__chip ${resultFilter === f.id ? 'students-filter__chip--active' : ''}`}
            onClick={() => onResultFilterChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="weekly-overview-toolbar__exports">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onPdf} disabled={exportsDisabled}>
          <i className="fa-solid fa-file-pdf" aria-hidden />
          PDF
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExcel} disabled={exportsDisabled}>
          <i className="fa-solid fa-file-excel" aria-hidden />
          Excel
        </button>
      </div>

      <p className="students-toolbar__meta">
        {loading
          ? 'جاري التحميل…'
          : resultCount === totalCount
            ? `${formatLatn(resultCount)} محاولة`
            : `${formatLatn(resultCount)} من ${formatLatn(totalCount)} محاولة`}
      </p>
    </section>
  )
}

export default function WeeklyOverview({ onBack }) {
  const [data, setData] = useState({ weekStartDate: '', sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('all')
  const [thumuns, setThumuns] = useState([])
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return toDateOnly(d)
  })
  const [to, setTo] = useState(() => toDateOnly(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await sessions.overview(from, to)
      setData({ weekStartDate: res.from, sessions: res.sessions })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r => r.json()).then(d => setThumuns(d.thumuns || [])).catch(() => {})
  }, [])

  async function useCurrentWeek() {
    try {
      const w = await sessions.weekly()
      const start = toDateOnly(w?.weekStartDate)
      if (!start) return
      const endDate = new Date(start)
      endDate.setDate(endDate.getDate() + 6)
      setFrom(start)
      setTo(toDateOnly(endDate))
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  const allSessions = data.sessions || []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allSessions
    if (resultFilter === 'pass') list = list.filter(item => item.passed)
    if (resultFilter === 'fail') list = list.filter(item => !item.passed)
    if (!q) return list
    return list.filter(item => {
      const name = (item.student_name || '').toLowerCase()
      const num = String(item.student_number ?? '')
      return num.includes(q) || name.includes(q)
    })
  }, [allSessions, query, resultFilter])

  const summary = useMemo(() => {
    const rows = data.sessions || []
    const studentIds = new Set(rows.map(r => r.student_id).filter(Boolean))
    const passes = rows.filter(r => r.passed).length
    const avg = rows.length
      ? rows.reduce((sum, r) => sum + Number(r.score || 0), 0) / rows.length
      : 0
    return {
      students: studentIds.size,
      attempts: rows.length,
      passRate: rows.length ? (passes / rows.length) * 100 : 0,
      avgScore: avg,
    }
  }, [data.sessions])

  function buildExportRows() {
    const grouped = new Map()
    for (const s of (data.sessions || [])) {
      const key = s.student_id
      const prev = grouped.get(key)
      if (!prev || new Date(s.created_at) > new Date(prev.created_at)) grouped.set(key, s)
    }
    return Array.from(grouped.values()).map(item => ({
      number: Number(item.student_number || 0),
      name: item.student_name || '',
      day: dayName(item.attempt_day),
      mode: modeLabel(item.mode),
      thumun: formatThumunId(item.thumun_id, thumuns),
      naqza: formatNaqzaForThumun(item.thumun_id, thumuns),
      fatha: formatLatn(item.fatha_prompts),
      taradud: formatLatn(item.taradud_count),
      result: resultLabel(item.passed),
      score: formatLatn(item.score),
      at: formatLocaleDateTime(formatAttemptDate(item)),
    })).sort((a, b) => (a.number || 0) - (b.number || 0))
  }

  function exportWeeklyExcel() {
    try {
      const rows = buildExportRows()
      const title = 'نظرة زمنية — ملخص لكل طالب'
      const styles = `table{border-collapse:collapse;width:100%;direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}th,td{border:1px solid #ccd3db;padding:8px;text-align:center}thead th{background:#f3f6fa;font-weight:700}h1{font-size:18px;margin:0 0 10px}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><p>من ${from} إلى ${to}</p>`
      html += '<table><thead><tr><th>الرقم</th><th>الاسم</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>النقزة</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${r.number}</td><td>${r.name}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.naqza}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      a.href = url
      a.download = `weekly_overview_${ts}.xls`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
    } catch (e) { setError(String(e?.message || e)) }
  }

  function exportWeeklyPDF() {
    try {
      const latestByStudent = new Map()
      for (const s of (data.sessions || [])) {
        const key = s.student_id
        const prev = latestByStudent.get(key)
        if (!prev || new Date(s.created_at) > new Date(prev.created_at)) latestByStudent.set(key, s)
      }
      const rows = Array.from(latestByStudent.values()).map(item => ({
        number: Number(item.student_number || 0),
        name: item.student_name || '',
        day: dayName(item.attempt_day),
        mode: modeLabel(item.mode),
        thumun: formatThumunId(item.thumun_id, thumuns),
        naqza: formatNaqzaForThumun(item.thumun_id, thumuns),
        fatha: formatLatn(item.fatha_prompts),
        taradud: formatLatn(item.taradud_count),
        result: resultLabel(item.passed),
        score: formatLatn(item.score),
        at: formatLocaleDateTime(formatAttemptDate(item)),
        sortAt: new Date(item.created_at).getTime(),
      })).sort((a, b) => a.sortAt - b.sortAt)
      const title = 'نظرة زمنية — ملخص لكل طالب'
      const styles = `@page{size:A4;margin:16mm}body{direction:rtl;font-family:'IBM Plex Sans Arabic',Arial;color:#111}h1{font-size:20px;margin:0 0 12px;text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3db;padding:6px 8px;text-align:center}thead th{background:#f3f6fa}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><p style="text-align:center">من ${from} إلى ${to}</p>`
      html += '<table><thead><tr><th>التسلسل</th><th>الاسم</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>النقزة</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      let idx = 1
      for (const r of rows) {
        html += `<tr><td>${formatLatn(idx++)}</td><td>${formatLatn(r.number)} — ${r.name}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.naqza}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const win = window.open('', '_blank')
      if (!win) return setError('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.')
      win.document.open()
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.focus(); win.print() }, 250)
    } catch (e) { setError(String(e?.message || e)) }
  }

  const hasSessions = allSessions.length > 0
  const emptyTitle = query.trim() || resultFilter !== 'all'
    ? 'لا نتائج'
    : 'لا توجد سجلات في هذه الفترة'
  const emptySubtitle = query.trim() || resultFilter !== 'all'
    ? 'جرّب بحثًا أو تصفية مختلفة، أو اضغط «مسح».'
    : 'غيّر الفترة أو انتظر اختبارات جديدة'

  return (
    <div className="reports-page weekly-overview-page stack">
      <PageHeader
        title="نظرة زمنية"
        subtitle={formatRangeLabel(from, to)}
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <i className="fa-solid fa-rotate" /> تحديث
          </button>
        )}
      />

      <div className="weekly-overview-dates">
        <DateRangePanel
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onCurrentWeek={useCurrentWeek}
        />
      </div>

      <WeeklyOverviewToolbar
        query={query}
        onQueryChange={setQuery}
        resultFilter={resultFilter}
        onResultFilterChange={setResultFilter}
        onPdf={exportWeeklyPDF}
        onExcel={exportWeeklyExcel}
        exportsDisabled={!hasSessions}
        resultCount={filtered.length}
        totalCount={allSessions.length}
        loading={loading}
      />

      {!loading && hasSessions && (
        <div className="stat-grid reports-summary weekly-overview-stats">
          <StatTile label="طلاب" value={formatLatn(summary.students)} icon="fa-solid fa-users" />
          <StatTile label="محاولات" value={formatLatn(summary.attempts)} icon="fa-solid fa-list-check" />
          <StatTile label="متوسط الدرجة" value={formatLatn1(summary.avgScore)} icon="fa-solid fa-chart-line" tone="accent" />
          <StatTile label="نسبة النجاح" value={`${formatLatn1(summary.passRate)}%`} icon="fa-solid fa-circle-check" tone="success" />
        </div>
      )}

      {error && (
        <div className="alert alert--error cluster" style={{ justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={load}>إعادة المحاولة</button>
        </div>
      )}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          subtitle={emptySubtitle}
          icon="fa-calendar-days"
        />
      ) : (
        <section className="weekly-overview-sessions" aria-label="سجل المحاولات">
          <header className="weekly-overview-sessions__head">
            <h2 className="weekly-overview-sessions__title">
              <i className="fa-solid fa-clock-rotate-left" aria-hidden />
              سجل المحاولات
            </h2>
            <span className="weekly-overview-sessions__count">{formatLatn(filtered.length)}</span>
          </header>
          <div className="session-list session-list--weekly">
            {filtered.map(item => (
              <SessionCard
                key={item.id}
                session={item}
                thumuns={thumuns}
                studentNumber={item.student_number}
                studentName={item.student_name}
                allowTimeEdit
                onTimeSaved={load}
                onTimeError={setError}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
