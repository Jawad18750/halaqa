import { useEffect, useState } from 'react'
import Clamp from './Clamp'
import { sessions } from '../api'

export default function WeeklyOverview({ onBack }) {
  const [data, setData] = useState({ weekStartDate: '', sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumuns, setThumuns] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await sessions.weekly()
        setData(res)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r=>r.json()).then(d=>setThumuns(d.thumuns||[])).catch(()=>{})
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <h2 style={{ textAlign:'center', marginTop:0 }}>نظرة أسبوعية — بداية الأسبوع: {data.weekStartDate ? new Date(data.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : ''}</h2>
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
                <div style={{ fontSize:12, color:'var(--muted)' }}>{new Date(item.created_at).toLocaleString('ar-EG-u-nu-latn')}</div>
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

