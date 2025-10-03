import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Auth from './components/Auth'
import Students from './components/Students'
import TestView from './components/TestView'
import StudentHistory from './components/StudentHistory'
import WeeklyOverview from './components/WeeklyOverview'
import Drawer from './components/Drawer'
import Dashboard from './components/Dashboard'
import About from './components/About'
import Privacy from './components/Privacy'
import { auth } from './api'

function App() {
  const [user, setUser] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [view, setView] = useState('dashboard') // dashboard | students | test | studentHistory | weekly | about | privacy
  const [drawerOpen, setDrawerOpen] = useState(false)
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
    // try auto login
    auth.me().then(({ user }) => setUser(user)).catch(() => {})
  }, [])

  useEffect(() => {
    function onNavToHistory(e){
      if (!selectedStudent) return
      setView('studentHistory')
    }
    window.addEventListener('navigate-student-history', onNavToHistory)
    return () => window.removeEventListener('navigate-student-history', onNavToHistory)
  }, [selectedStudent])

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
    <>
    <div className="container">
      <div className="brand" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
        <button className="btn btn--ghost" onClick={() => setView('dashboard')} style={{ padding:0, border:'none', background:'transparent' }}>
          <img className="app-logo" src={theme === 'dark' ? '/quran-white.png' : '/quran.png'} alt="شعار التطبيق" width="56" height="56" style={{ borderRadius: 8 }} />
        </button>
        <button className="btn btn--ghost" onClick={() => setView('dashboard')} style={{ padding:0, border:'none', background:'transparent' }}>
          <h1 className="hero-title" style={{ marginBottom: 0 }}>اختبار القرآن الكريم</h1>
        </button>
      </div>

      <button aria-label="تبديل الوضع" className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ display: drawerOpen ? 'none' : undefined }}>
        {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
      </button>
      <button className="menu-toggle" onClick={() => setDrawerOpen(true)} aria-label="القائمة" style={{ display: drawerOpen ? 'none' : undefined }}>
        ☰
      </button>

      {!user ? (
        <div className="stage" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 16, minHeight: '70vh' }}>
          {/* Free randomizer for guests */}
          <div className="controls" style={{ maxWidth: 560, width: '100%' }}>
            <label>
              النقزة:
              <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} className="input">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{`${n} - ${NAQZA_LABELS[n-1]}`}</option>
                ))}
              </select>
            </label>
            <span className="or">أو</span>
            <label>
              الجزء:
              <select value={juz} onChange={e => setJuz(e.target.value)} className="input">
                <option value="">—</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{`${n} - ${JUZ_NAMES[n-1]}`}</option>
                ))}
              </select>
            </label>
            <button className="btn btn--primary" style={{ gridColumn: '1 / -1', justifySelf:'center' }} onClick={pickRandom} disabled={loading || !filtered.length}>اختر ثُمُناً عشوائياً</button>
          </div>
          <div className="meta" style={{ marginTop: 8 }}>{loading ? 'جاري التحميل…' : `عدد الأثمان المتاحة: ${filtered.length}`}</div>
          {current && (
            <div className="card appear" style={{ marginTop: 16, maxWidth: 720 }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>الثُمُن رقم {current.id}</div>
              <div className="phrase">{current.name || '—'}</div>
              <div className="info-grid">
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
      ) : (
        <div className="stage" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center' }}>
          {view === 'dashboard' && (
            <Dashboard />
          )}
          {view === 'students' && !selectedStudent && (
            <Students onSelect={(s) => { setSelectedStudent(s); setView('test') }} />
          )}
          {view === 'test' && selectedStudent && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:8, justifyContent:'center' }}>
                <button className="btn" onClick={() => { setSelectedStudent(null); setView('students') }}>
                  ← الرجوع
                </button>
                <button className="btn" onClick={() => setView('studentHistory')}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ marginInlineStart:6 }}></i>
                  سجل الطالب
                </button>
              </div>
              <TestView student={selectedStudent} thumuns={thumuns} onDone={() => { setView('studentHistory') }} />
            </>
          )}
          {view === 'studentHistory' && selectedStudent && (
            <StudentHistory student={selectedStudent} onBack={() => setView('test')} />
          )}
          {view === 'weekly' && (
            <WeeklyOverview onBack={() => setView('students')} />
          )}
          {view === 'about' && (
            <About onBack={() => setView('dashboard')} />
          )}
          {view === 'privacy' && (
            <Privacy onBack={() => setView('dashboard')} />
          )}
        </div>
      )}
      {/* (Intentionally removed legacy duplicate meta and result card) */}
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
    <Drawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      user={user}
      onAuthed={setUser}
      onNavigate={(v) => setView(v)}
      onLogout={() => { auth.logout(); setUser(null); setView('dashboard'); setSelectedStudent(null) }}
    />
    </>
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
