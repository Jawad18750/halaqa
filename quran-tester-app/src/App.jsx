import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const [thumuns, setThumuns] = useState([])
  const [naqza, setNaqza] = useState(1)
  const [juz, setJuz] = useState('')
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('fontScale') || 1))
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('contrast') === '1')

  // Juz names (traditional labels)
  const JUZ_NAMES = useMemo(() => ([
    'الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا',
    'يعتذرون', 'وما من دابة', 'وما أبرئ نفسي', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب', 'قد أفلح', 'وقال الذين', 'أمن خلق',
    'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم السجدة', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'
  ]), [])
  // Naqza labels from first thumun name within each naqza
  const NAQZA_LABELS = useMemo(() => {
    const labels = []
    for (let n = 1; n <= 20; n++) {
      const first = thumuns.filter(t => t.naqza === n).sort((a, b) => a.id - b.id)[0]
      labels.push(first && first.name ? first.name : `النقزة ${n}`)
    }
    return labels
  }, [thumuns])

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.lang = 'ar'
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    const link = document.querySelector("link[rel='icon']")
    if (link) link.href = theme === 'dark' ? '/quran-white.png' : '/quran.png'
    // Footer author logo remains SVG, but invert color in dark via CSS
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale))
    localStorage.setItem('fontScale', String(fontScale))
  }, [fontScale])

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal'
    localStorage.setItem('contrast', highContrast ? '1' : '0')
  }, [highContrast])

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/quran-thumun-data.json', { cache: 'no-cache' })
        const data = await res.json()
        setThumuns(data.thumuns || [])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filtered = useMemo(() => {
    if (!thumuns.length) return []
    if (juz) {
      return thumuns.filter(t => t.juz === Number(juz))
    }
    return thumuns.filter(t => t.naqza === Number(naqza))
  }, [thumuns, naqza, juz])

  function pickRandom() {
    if (!filtered.length) return
    // Avoid immediate repeat if possible
    const pool = current ? filtered.filter(t => t.id !== current.id) : filtered
    const base = pool.length ? pool : filtered
    const idx = Math.floor(Math.random() * base.length)
    setCurrent(base[idx])
  }

  return (
    <div className="container" style={{
      fontFamily: "'Cairo', system-ui, -apple-system, Segoe UI, Roboto, Arial"
    }}>
      <div className="brand" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
        <img className="app-logo" src={theme === 'dark' ? '/quran-white.png' : '/quran.png'} alt="شعار التطبيق" width="56" height="56" style={{ borderRadius: 8 }} />
        <h1 className="hero-title" style={{ marginBottom: 0 }}>اختبار القرآن الكريم</h1>
      </div>

      <button aria-label="تبديل الوضع" className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
      </button>

      <div className="stage" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="controls">
        <label>
          النقزة:
          <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} style={{ marginInlineStart: 8 }}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{`${n} - ${NAQZA_LABELS[n-1]}`}</option>
            ))}
          </select>
        </label>

        <span className="or">أو</span>

        <label>
          الجزء:
          <select value={juz} onChange={e => setJuz(e.target.value)} style={{ marginInlineStart: 8 }}>
            <option value="">—</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{`${n} - ${JUZ_NAMES[n-1]}`}</option>
            ))}
          </select>
        </label>

        <button className="primary-btn" onClick={pickRandom} disabled={loading || !filtered.length} style={{ padding: '10px 16px' }}>
          اختر ثُمُناً عشوائياً
        </button>
      </div>

      <div style={{ marginTop: 24, color: '#666' }}>
        {loading ? 'جاري التحميل…' : `عدد الأثمان المتاحة: ${filtered.length}`}
      </div>

      {!loading && filtered.length === 0 && (
        <div role="status" aria-live="polite" style={{ marginTop: 12, color: '#999', textAlign: 'center' }}>
          لا توجد نتائج لهذا التحديد. غيّر النقزة أو الجزء.
        </div>
      )}

      {current && (
        <div className="card appear" style={{
          marginTop: 24
        }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>
            الثُمُن رقم {current.id}
          </div>
          <div className="phrase">
            {current.name || '—'}
          </div>
          <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <Info label="السورة" value={current.surah || '—'} />
            <Info label="رقم السورة" value={current.surahNumber ?? '—'} />
            <Info label="الحزب" value={current.hizb ?? '—'} />
            <Info label="الربع" value={current.quarter ?? '—'} />
            <Info label="الجزء" value={current.juz ?? '—'} />
            <Info label="النقزة" value={current.naqza ?? '—'} />
          </div>
        </div>
      )}
      </div>
      {/* Accessibility floating panel */}
      <div className="a11y-fab">
        <details>
          <summary aria-label="خيارات الوصول"><i className="fa-solid fa-universal-access"></i></summary>
          <div className="panel">
            <button onClick={() => setFontScale(Math.max(0.85, fontScale - 0.05))}>A-</button>
            <button onClick={() => setFontScale(Math.min(1.3, fontScale + 0.05))}>A+</button>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <input type="checkbox" checked={highContrast} onChange={e => setHighContrast(e.target.checked)} /> تباين مرتفع
            </label>
          </div>
        </details>
      </div>
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

export default App
