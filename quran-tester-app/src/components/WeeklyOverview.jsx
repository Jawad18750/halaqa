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
import DashboardWidget from './ui/DashboardWidget.jsx'
import EmptyState from './ui/EmptyState.jsx'
import SessionCard from './ui/SessionCard.jsx'
import StatTile from './ui/StatTile.jsx'

function formatNaqzaForThumun(id, thumuns) {
  const t = thumuns.find(x => x.id === Number(id))
  if (!t || !t.naqza) return ''
  return formatNaqza(t.naqza, thumuns)
}

export default function WeeklyOverview({ onBack }) {
  const [data, setData] = useState({ weekStartDate: '', sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
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

  const filtered = useMemo(() => {
    const q = query.trim()
    const list = data.sessions || []
    if (!q) return list
    return list.filter(item =>
      String(item.student_number).includes(q) ||
      (item.student_name || '').includes(q)
    )
  }, [data.sessions, query])

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

  return (
    <div className="reports-page stack">
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

      <DateRangePanel
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onCurrentWeek={useCurrentWeek}
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="بحث بالاسم أو رقم الطالب"
        footer={loading ? 'جاري التحميل…' : `${formatLatn(filtered.length)} محاولة${query.trim() ? ' مطابقة' : ''}`}
        actions={(
          <>
            <button type="button" className="btn btn--ghost btn--sm" onClick={exportWeeklyPDF} disabled={!data.sessions.length}>
              <i className="fa-solid fa-file-pdf" /> PDF
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={exportWeeklyExcel} disabled={!data.sessions.length}>
              <i className="fa-solid fa-file-excel" /> Excel
            </button>
          </>
        )}
      />

      {!loading && data.sessions.length > 0 && (
        <div className="stat-grid stat-grid--fit reports-summary">
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
          title={query.trim() ? 'لا نتائج' : 'لا توجد سجلات في هذه الفترة'}
          subtitle={query.trim() ? 'جرّب بحثاً مختلفاً' : 'غيّر الفترة أو انتظر اختبارات جديدة'}
          icon="fa-calendar-days"
        />
      ) : (
        <DashboardWidget
          title="سجل المحاولات"
          icon="fa-clock-rotate-left"
          badge={formatLatn(filtered.length)}
          variant="default"
        >
          <div className="session-list">
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
        </DashboardWidget>
      )}
    </div>
  )
}
