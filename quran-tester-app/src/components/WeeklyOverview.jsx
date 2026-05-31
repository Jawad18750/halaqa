import { useEffect, useState, useCallback } from 'react'
import { sessions } from '../api'
import {
  modeLabel,
  resultLabel,
  dayName,
  formatThumunId,
  formatNaqza,
  formatLocaleDateTime,
  formatAttemptDate,
} from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import EmptyState from './ui/EmptyState.jsx'
import SessionCard from './ui/SessionCard.jsx'

function toDateOnly(v) {
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

function num(n) {
  if (n === null || n === undefined) return ''
  const val = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(val) ? val.toLocaleString('ar-EG-u-nu-latn') : String(n)
}

function formatNaqzaForThumun(id, thumuns) {
  const t = thumuns.find(x => x.id === Number(id))
  if (!t || !t.naqza) return ''
  return formatNaqza(t.naqza, thumuns)
}

export default function WeeklyOverview({ onBack }) {
  const [data, setData] = useState({ weekStartDate: '', sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumuns, setThumuns] = useState([])
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return toDateOnly(d)
  })
  const [to, setTo] = useState(() => toDateOnly(new Date()))

  const load = useCallback(async () => {
    setLoading(true); setError('')
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
      fatha: num(item.fatha_prompts),
      taradud: num(item.taradud_count),
      result: resultLabel(item.passed),
      score: num(item.score),
      at: formatLocaleDateTime(formatAttemptDate(item)),
    })).sort((a, b) => (a.number || 0) - (b.number || 0))
  }

  function exportWeeklyExcel() {
    try {
      const rows = buildExportRows()
      const title = `نظرة أسبوعية — ملخص لكل طالب`
      const styles = `table{border-collapse:collapse;width:100%;direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}th,td{border:1px solid #ccd3db;padding:8px;text-align:center}thead th{background:#f3f6fa;font-weight:700}h1{font-size:18px;margin:0 0 10px}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><p>من ${from} إلى ${to}</p>`
      html += '<table><thead><tr><th>الرقم</th><th>الاسم</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>النقزة</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${num(r.number)}</td><td>${r.name}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.naqza}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
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
        fatha: num(item.fatha_prompts),
        taradud: num(item.taradud_count),
        result: resultLabel(item.passed),
        score: num(item.score),
        at: formatLocaleDateTime(formatAttemptDate(item)),
        sortAt: new Date(item.created_at).getTime(),
      })).sort((a, b) => a.sortAt - b.sortAt)
      const title = `نظرة أسبوعية — ملخص لكل طالب`
      const styles = `@page{size:A4;margin:16mm}body{direction:rtl;font-family:'IBM Plex Sans Arabic',Arial;color:#111}h1{font-size:20px;margin:0 0 12px;text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3db;padding:6px 8px;text-align:center}thead th{background:#f3f6fa}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><p style="text-align:center">من ${from} إلى ${to}</p>`
      html += '<table><thead><tr><th>التسلسل</th><th>الاسم</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>النقزة</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      let idx = 1
      for (const r of rows) {
        html += `<tr><td>${num(idx++)}</td><td>${num(r.number)} — ${r.name}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.naqza}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const win = window.open('', '_blank')
      if (!win) return setError('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.')
      win.document.open(); win.document.write(html); win.document.close()
      setTimeout(() => { win.focus(); win.print() }, 250)
    } catch (e) { setError(String(e?.message || e)) }
  }

  return (
    <div className="stack">
      <PageHeader title="نظرة زمنية" subtitle={`من ${from} إلى ${to}`} onBack={onBack} />
      <div className="filter-bar">
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field__label">من</span>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field__label">إلى</span>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn btn--sm" onClick={useCurrentWeek}>هذا الأسبوع</button>
      </div>
      <div className="profile-toolbar mobile-center">
        <span className="meta">ملخص لكل طالب</span>
        <button type="button" className="btn btn--sm" onClick={exportWeeklyPDF}><i className="fa-solid fa-file-pdf" /> PDF</button>
        <button type="button" className="btn btn--sm" onClick={exportWeeklyExcel}><i className="fa-solid fa-file-excel" /> Excel</button>
      </div>
      {error && (
        <div className="alert alert--error cluster" style={{ justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={load}>إعادة المحاولة</button>
        </div>
      )}
      {loading ? <div className="loading">جاري التحميل…</div> : (
        <SectionCard>
          {data.sessions.length === 0 ? (
            <EmptyState title="لا توجد سجلات في هذه الفترة" icon="fa-calendar" />
          ) : (
            <>
              <div className="desktop-only profile-table-wrapper">
                <table className="responsive-table profile-table">
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>اليوم</th>
                      <th>الوضع</th>
                      <th>الثمن</th>
                      <th>النقزة</th>
                      <th>الفتحة</th>
                      <th>التردد</th>
                      <th>النتيجة</th>
                      <th>الدرجة</th>
                      <th>التاريخ/الوقت</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map(item => (
                      <tr key={item.id}>
                        <td>{`${num(item.student_number)} — ${item.student_name}`}</td>
                        <td>{dayName(item.attempt_day)}</td>
                        <td>{modeLabel(item.mode)}</td>
                        <td>{formatThumunId(item.thumun_id, thumuns)}</td>
                        <td>{formatNaqzaForThumun(item.thumun_id, thumuns) || '—'}</td>
                        <td>{num(item.fatha_prompts)}</td>
                        <td>{num(item.taradud_count)}</td>
                        <td>{resultLabel(item.passed)}</td>
                        <td>{num(item.score)}</td>
                        <td>{formatLocaleDateTime(formatAttemptDate(item))}</td>
                        <td>
                          <EditableTime row={item} onSaved={load} onError={setError} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-cards timeline">
                {data.sessions.map(item => (
                  <SessionCard key={item.id} session={item} thumuns={thumuns} />
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}
    </div>
  )
}

function EditableTime({ row, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(toLocalInput(row.attempt_at || row.created_at))
  function toLocalInput(iso) {
    try { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) } catch { return '' }
  }
  function toIsoLocal(input) {
    try { const d = new Date(input); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString() } catch { return null }
  }
  async function save() {
    try {
      const iso = toIsoLocal(val)
      if (!iso) return onError('تاريخ غير صالح')
      await sessions.updateTime(row.id, iso)
      setEditing(false)
      onSaved?.()
    } catch (e) { onError(String(e?.message || e)) }
  }
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <span>{formatLocaleDateTime(formatAttemptDate(row))}</span>
      <button type="button" className="icon-btn" aria-label="تعديل الوقت" title="تعديل الوقت" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /></button>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <input type="datetime-local" className="input" value={val} onChange={e => setVal(e.target.value)} style={{ width: 220 }} />
      <button type="button" className="icon-btn btn--primary" aria-label="حفظ" title="حفظ" onClick={save}><i className="fa-solid fa-check" /></button>
      <button type="button" className="icon-btn" aria-label="إلغاء" title="إلغاء" onClick={() => { setEditing(false); setVal(toLocalInput(row.attempt_at || row.created_at)) }}><i className="fa-solid fa-xmark" /></button>
    </div>
  )
}
