import { useEffect, useMemo, useState } from 'react'
import { sessions } from '../api'

export default function TestView({ student, thumuns, onDone }) {
  const [mode, setMode] = useState('naqza')
  const [juz, setJuz] = useState('')
  const [current, setCurrent] = useState(null)
  const [fatha, setFatha] = useState(0)
  const [taradud, setTaradud] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(''),2000)}

  const JUZ_NAMES = useMemo(() => ([
    'الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا',
    'يعتذرون', 'وما من دابة', 'وما أبرئ نفسي', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب', 'قد أفلح', 'وقال الذين', 'أمن خلق',
    'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم السجدة', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'
  ]), [])

  function formatNaqza(n){
    const num = Number(n)
    if (!num || !thumuns?.length) return String(n ?? '')
    const first = thumuns.filter(t => t.naqza === num).sort((a,b)=>a.id-b.id)[0]
    const name = first?.name || `النقزة ${num}`
    return `${num} - ${name}`
  }

  function formatJuz(n){
    const num = Number(n)
    if (!num) return String(n ?? '')
    const name = JUZ_NAMES[num-1] || `الجزء ${num}`
    return `${num} - ${name}`
  }

  const filtered = useMemo(() => {
    if (!thumuns?.length) return []
    if (mode === 'juz' && juz) return thumuns.filter(t => t.juz === Number(juz))
    return thumuns.filter(t => t.naqza === Number(student.current_naqza))
  }, [thumuns, mode, juz, student])

  function pickRandom() {
    if (!filtered.length) return
    const base = current ? filtered.filter(t => t.id !== current.id) : filtered
    const pool = base.length ? base : filtered
    const idx = Math.floor(Math.random() * pool.length)
    setCurrent(pool[idx])
  }

  useEffect(() => { setCurrent(null) }, [mode, juz, student.current_naqza])

  async function finalize(passed) {
    if (!current) return
    // Pass strictly depends on Fatha < 4
    const effectivePassed = fatha < 4
    // Client mirror of server scoring guarantees
    const fathaPenaltyTier = fatha >= 3 ? 30 : fatha === 2 ? 20 : fatha === 1 ? 10 : 0
    const hesitationPenalty = Math.min(10, Math.max(0, taradud - 3) * 1)
    let score
    if (effectivePassed) {
      score = Math.max(60, Math.min(100, 100 - (fathaPenaltyTier + hesitationPenalty)))
    } else {
      score = Math.max(0, Math.min(59, 59 - ((Math.max(0, fatha - 4)) * 5) - Math.min(20, taradud)))
    }
    const payload = {
      studentId: student.id,
      mode,
      selectedNaqza: mode === 'naqza' ? student.current_naqza : null,
      selectedJuz: mode === 'juz' ? Number(juz) : null,
      thumunId: current.id,
      fathaPrompts: fatha,
      taradudCount: taradud,
      passed: effectivePassed,
      score
    }
    setSaving(true)
    setError('')
    try {
      await sessions.create(payload)
      // After finalize, go to this student's history view
      window.dispatchEvent(new CustomEvent('navigate-student-history', { detail: { studentId: student.id } }))
      onDone?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="test-container" style={{ padding:16, display:'grid', gap:16 }}>
      <div className="card appear" style={{ display:'grid', gap:8 }}>
        <div className="info-grid info-grid--fit">
          <Info label="الطالب" value={`${student.name}`} />
          <Info label="رقم الطالب" value={`${student.number}`} />
          <Info label="النقزة الحالية" value={formatNaqza(student.current_naqza)} />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>
          <label className="info-label" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            الوضع:
            <select className="input" value={mode} onChange={e => setMode(e.target.value)} style={{ width:160 }}>
              <option value="naqza">حسب النقزة</option>
              <option value="juz">حسب الجزء</option>
            </select>
          </label>
          {mode === 'juz' && (
            <label className="info-label" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              الجزء:
              <select className="input" value={juz} onChange={e => setJuz(e.target.value)} style={{ width:120 }}>
                <option value="">—</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div style={{ textAlign:'center' }}>
          <button className="btn btn--primary" onClick={pickRandom} disabled={!filtered.length}>اختر ثُمُناً عشوائياً</button>
          <div className="meta" style={{ marginTop:6 }}>عدد الأثمان المتاحة: {filtered.length}</div>
        </div>
      </div>

      {current && (
        <div className="card appear" style={{ display:'grid', gap:10 }}>
          <div className="phrase" style={{ marginBottom:0 }}>الثُمُن رقم {current.id}</div>
          <div className="phrase">{current.name}</div>
          <div className="info-grid">
            <Info label="السورة" value={current.surah} />
            <Info label="رقم السورة" value={current.surahNumber} />
            <Info label="الحزب" value={current.hizb} />
            <Info label="الربع" value={current.quarter} />
            <Info label="الجزء" value={formatJuz(current.juz)} />
            <Info label="النقزة" value={formatNaqza(current.naqza)} />
          </div>
        </div>
      )}

      <div className="card appear" style={{ display:'grid', gap:12 }}>
        <div className="info-grid info-grid--fit">
          <div className="info">
            <div className="info-label">الفتحة</div>
            <div className="info-value">{fatha} / 3</div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:6 }}>
              <button className="btn" onClick={() => setFatha(Math.min(10, fatha + 1))}>+</button>
              <button className="btn" onClick={() => setFatha(Math.max(0, fatha - 1))}>-</button>
            </div>
          </div>
          <div className="info">
            <div className="info-label">التردد</div>
            <div className="info-value">{taradud}</div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:6 }}>
              <button className="btn" onClick={() => setTaradud(taradud + 1)}>+</button>
              <button className="btn" onClick={() => setTaradud(Math.max(0, taradud - 1))}>-</button>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:8 }}>
          <button className="btn btn--primary" disabled={!current || saving || fatha >= 4} onClick={async () => { await finalize(true); showToast('تم التسجيل: نجح') }}>نجح</button>
          <button className="btn" disabled={!current || saving} onClick={async () => { await finalize(false); showToast('تم التسجيل: فشل') }}>فشل</button>
        </div>
        {error && <div style={{ color:'crimson' }}>{error}</div>}
      </div>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="info" style={{ padding: 8, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
      <div className="info-label" style={{ color: '#777', fontSize: 12 }}>{label}</div>
      <div className="info-value" style={{ fontSize: 16 }}>{value}</div>
    </div>
  )
}

