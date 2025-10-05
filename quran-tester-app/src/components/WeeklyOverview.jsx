import { useEffect, useState } from 'react'
import Clamp from './Clamp'
import { sessions } from '../api'

export default function WeeklyOverview({ onBack }) {
  const [data, setData] = useState({ weekStartDate: '', sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumuns, setThumuns] = useState([])
  function toDateOnly(v){
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
        const mm = String(d.getMonth()+1).padStart(2,'0')
        const dd = String(d.getDate()).padStart(2,'0')
        return `${yyyy}-${mm}-${dd}`
      }
    } catch {}
    return ''
  }
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-6)
    return toDateOnly(d)
  })
  const [to, setTo] = useState(() => toDateOnly(new Date()))

  function buildRows() {
    return (data.sessions || []).map(item => ({
      student: `${num(item.student_number)} — ${item.student_name}`,
      day: dayName(item.attempt_day),
      mode: item.mode === 'naqza' ? 'النقزة' : (item.mode === 'juz' ? 'الجزء' : item.mode),
      thumun: formatThumun(item.thumun_id, thumuns),
      fatha: num(item.fatha_prompts),
      taradud: num(item.taradud_count),
      result: item.passed ? 'ناجح' : 'راسب',
      score: num(item.score),
      at: new Date(item.created_at).toLocaleString('ar-EG-u-nu-latn')
    }))
  }

  function exportWeeklyExcel() {
    try {
      const rows = buildRows()
      const title = `نظرة أسبوعية — ${data.weekStartDate ? new Date(data.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : ''}`
      const styles = `table{border-collapse:collapse;width:100%;direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}th,td{border:1px solid #ccd3db;padding:8px;text-align:center}thead th{background:#f3f6fa;font-weight:700}h1{font-size:18px;margin:0 0 10px}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1>`
      html += '<table><thead><tr><th>الطالب</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${r.student}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const blob = new Blob(["\ufeff" + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)
      a.href = url
      a.download = `weekly_overview_${ts}.xls`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
    } catch (e) { setError(String(e?.message || e)) }
  }

  function exportWeeklyPDF() {
    try {
      const rows = buildRows()
      const title = `نظرة أسبوعية — بداية الأسبوع: ${data.weekStartDate ? new Date(data.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : ''}`
      const styles = `@page{size:A4;margin:16mm}body{direction:rtl;font-family:'IBM Plex Sans Arabic',Arial;color:#111}h1{font-size:20px;margin:0 0 12px;text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3db;padding:6px 8px;text-align:center}thead th{background:#f3f6fa}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1>`
      html += '<table><thead><tr><th>الطالب</th><th>اليوم</th><th>الوضع</th><th>الثمن</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th><th>التاريخ/الوقت</th></tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${r.student}</td><td>${r.day}</td><td>${r.mode}</td><td>${r.thumun}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td><td>${r.at}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const win = window.open('', '_blank')
      if (!win) return setError('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.')
      win.document.open(); win.document.write(html); win.document.close()
      setTimeout(() => { win.focus(); win.print() }, 250)
    } catch (e) { setError(String(e?.message || e)) }
  }

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const res = await sessions.overview(from, to)
        setData({ weekStartDate: res.from, sessions: res.sessions })
      } catch (e) { setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, [from, to])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r=>r.json()).then(d=>setThumuns(d.thumuns||[])).catch(()=>{})
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <h2 style={{ textAlign:'center', marginTop:0 }}>نظرة زمنية — من {from} إلى {to}</h2>
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginTop:8 }}>
        <label className="info-label" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          من:
          <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        </label>
        <label className="info-label" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          إلى:
          <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
        </label>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <button className="btn" onClick={exportWeeklyPDF}>تصدير PDF</button>
        <button className="btn" onClick={exportWeeklyExcel}>تصدير Excel</button>
      </div>
      {error && <div style={{ color:'crimson' }}>{error}</div>}
      {loading ? 'جاري التحميل…' : (
        <div style={{ marginTop: 12, display:'grid', gap:8 }}>
          {data.sessions.length === 0 && <div>لا يوجد سجلات هذا الأسبوع.</div>}
          {data.sessions.map(item => (
            <div key={item.id} className="card" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:8 }}>
              <Cell label="الطالب">{num(item.student_number)} — {item.student_name}</Cell>
              <Cell label="اليوم">{dayName(item.attempt_day)}</Cell>
              <Cell label="الوضع">{item.mode === 'naqza' ? 'النقزة' : 'الجزء'}</Cell>
              <Cell label="الثمن">{formatThumun(item.thumun_id, thumuns)}</Cell>
              <Cell label="الفتحة/التردد">{num(item.fatha_prompts)} / {num(item.taradud_count)}</Cell>
              <Cell label="النتيجة">
                <Clamp text={`${item.passed ? 'ناجح' : 'راسب'} — ${num(item.score)} — ${grade(item.score)}`} lines={2} />
                <div style={{ fontSize:12, color:'var(--muted)' }}>
                  <EditableTime row={item} onSaved={() => { setLoading(true); sessions.overview(from,to).then(r=>{ setData({ weekStartDate:r.from, sessions:r.sessions }); setLoading(false) }).catch(()=>setLoading(false)) }} />
                </div>
              </Cell>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Cell({ label, children }) {
  return (
    <div className="info" style={{ padding: 8, background:'var(--card-bg)', borderRadius:8, border:'1px solid var(--card-border)' }}>
      <div className="info-label" style={{ color:'var(--muted)', fontSize:12 }}>{label}</div>
      <div className="info-value" style={{ fontSize:16 }}>{children}</div>
    </div>
  )
}

function num(n){
  if (n === null || n === undefined) return ''
  const val = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(val) ? val.toLocaleString('ar-EG-u-nu-latn') : String(n)
}

function dayName(code){
  switch(code){
    case 'sun': return 'الأحد'
    case 'mon': return 'الاثنين'
    case 'tue': return 'الثلاثاء'
    case 'wed': return 'الأربعاء'
    case 'thu': return 'الخميس'
    case 'fri': return 'الجمعة'
    case 'sat': return 'السبت'
    default: return ''
  }
}

function grade(score){
  const s = Number(score || 0)
  if (s >= 90) return 'ممتاز'
  if (s >= 80) return 'جيد جدًا'
  if (s >= 70) return 'جيد'
  if (s >= 60) return 'مقبول'
  return 'راسب'
}

function formatThumun(id, thumuns){
  const t = thumuns.find(x => x.id === Number(id))
  if (!t) return num(id)
  return `${num(t.id)} - ${t.name}`
}

function EditableTime({ row, onSaved }){
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(toLocalInput(row.attempt_at || row.created_at))
  function toLocalInput(iso){
    try { const d = new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) } catch { return '' }
  }
  function toIsoLocal(input){
    try { const d = new Date(input); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString() } catch { return null }
  }
  async function save(){
    try {
      const iso = toIsoLocal(val)
      if (!iso) return alert('تاريخ غير صالح')
      await sessions.updateTime(row.id, iso)
      setEditing(false)
      onSaved?.()
    } catch (e) { alert(String(e?.message||e)) }
  }
  if (!editing) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <span>{new Date(row.attempt_at || row.created_at).toLocaleString('ar-EG-u-nu-latn')}</span>
      <button className="icon-btn" title="تعديل الوقت" onClick={()=>setEditing(true)}><i className="fa-solid fa-pen"></i></button>
    </div>
  )
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <input type="datetime-local" className="input" value={val} onChange={e=>setVal(e.target.value)} style={{ width: 220 }} />
      <button className="icon-btn btn--primary" title="حفظ" onClick={save}><i className="fa-solid fa-check"></i></button>
      <button className="icon-btn" title="إلغاء" onClick={()=>{ setEditing(false); setVal(toLocalInput(row.attempt_at || row.created_at)) }}><i className="fa-solid fa-xmark"></i></button>
    </div>
  )
}

