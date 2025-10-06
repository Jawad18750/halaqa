import { useEffect, useState } from 'react'
import { sessions } from '../api'
import Clamp from './Clamp'

export default function StudentHistory({ student, onBack }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumuns, setThumuns] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const { sessions: s } = await sessions.forStudent(student.id)
        setList(s)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [student.id])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r=>r.json()).then(d=>setThumuns(d.thumuns||[])).catch(()=>{})
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <h2 style={{ textAlign:'center', marginTop: 0 }}>سجل الطالب — {student.name} (رقم {num(student.number)})</h2>
      {error && <div style={{ color:'crimson' }}>{error}</div>}
      {loading ? 'جاري التحميل…' : (
        <div style={{ marginTop: 12, display:'grid', gap:8 }}>
          {list.length === 0 && <div>لا يوجد سجلات بعد.</div>}
          {list.map(item => (
            <div key={item.id} className="card student-history-card">
              <Cell label="الأسبوع">{new Date(item.week_start_date).toLocaleDateString('ar-EG-u-nu-latn')}</Cell>
              <Cell label="اليوم">{dayName(item.attempt_day)}</Cell>
              <Cell label="الثمن"><Clamp text={formatThumun(item.thumun_id, thumuns)} /></Cell>
              {item.juz && <Cell label="الجزء"><Clamp text={formatJuz(item.juz)} /></Cell>}
              {item.naqza && <Cell label="النقزة"><Clamp text={formatNaqza(item.naqza, thumuns)} /></Cell>}
              <Cell label="الفتحة/التردد">{num(item.fatha_prompts)} / {num(item.taradud_count)}</Cell>
              <Cell label="النتيجة">
                <Clamp text={`${item.passed ? 'ناجح' : 'راسب'} — ${num(item.score)} — ${grade(item.score)}`} />
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
  const numVal = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(numVal) ? numVal.toLocaleString('ar-EG-u-nu-latn') : String(n)
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

function formatNaqza(n, thumuns){
  const numN = Number(n)
  if (!numN) return '—'
  const first = thumuns.filter(t => t.naqza === numN).sort((a,b)=>a.id-b.id)[0]
  const name = first?.name || `النقزة ${numN}`
  return `${num(numN)} - ${name}`
}

function formatJuz(n){
  const names = ['الم','سيقول','تلك الرسل','لن تنالوا','والمحصنات','لا يحب الله','وإذا سمعوا','ولو أننا','قال الملأ','واعلموا','يعتذرون','وما من دابة','وما أبرئ نفسي','ربما','سبحان الذي','قال ألم','اقترب','قد أفلح','وقال الذين','أمن خلق','اتل ما أوحي','ومن يقنت','وما لي','فمن أظلم','إليه يرد','حم السجدة','قال فما خطبكم','قد سمع الله','تبارك الذي','عم']
  const numJ = Number(n)
  if (!numJ) return '—'
  const name = names[numJ-1] || `الجزء ${numJ}`
  return `${num(numJ)} - ${name}`
}

