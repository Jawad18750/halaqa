import { useEffect, useMemo, useRef, useState } from 'react'
import Auth from './components/Auth'
import Students from './components/Students'
import StudentProfile from './components/StudentProfile'
import TestView from './components/TestView'
import StudentHistory from './components/StudentHistory'
import WeeklyOverview from './components/WeeklyOverview'
import Drawer from './components/Drawer'
import Dashboard from './components/Dashboard'
import About from './components/About'
import Privacy from './components/Privacy'
import ResetPassword from './components/ResetPassword'
import { auth, getToken } from './api'

function App() {
  const [user, setUser] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [view, setView] = useState('dashboard') // dashboard | students | test | studentHistory | weekly | about | privacy | freestyle
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [thumuns, setThumuns] = useState([])
  const [naqza, setNaqza] = useState(1)
  const [juz, setJuz] = useState('')
  const [guestMode, setGuestMode] = useState('naqza')
  const [guestFiveHizb, setGuestFiveHizb] = useState('')
  const [guestQuarter, setGuestQuarter] = useState('')
  const [guestHalf, setGuestHalf] = useState('')
  const [current, setCurrent] = useState(null)
  const resultRef = useRef(null)
  const [highlight, setHighlight] = useState(false)
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

  // Deep-link handling for reset password route
  useEffect(() => {
    try {
      if (window.location.pathname.startsWith('/reset')) {
        setView('reset')
      }
    } catch {}
  }, [])

  useEffect(() => {
    // try auto login only if a token exists to avoid 401 noise
    if (getToken()) {
      auth.me().then(({ user }) => setUser(user)).catch(() => {})
    }
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

  // Update mode data-attribute for hero color
  useEffect(() => {
    const mode = !user ? guestMode : (view === 'test' ? 'naqza' : view === 'students' ? 'naqza' : view === 'dashboard' ? 'naqza' : view)
    if (mode) document.documentElement.dataset.mode = mode
  }, [view, user, guestMode])

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

  function fiveHizbGroupOf(hizb){
    const num = Number(hizb || 0)
    return num > 0 ? Math.floor((num - 1) / 5) + 1 : null
  }
  function naqzaName(n){
    const num = Number(n || 0)
    if (!num || !thumuns.length) return ''
    const first = thumuns.filter(t => t.naqza === num).sort((a,b)=>a.id-b.id)[0]
    return first?.name || ''
  }
  function juzName(n){
    const num = Number(n || 0)
    if (!num) return ''
    return JUZ_NAMES[num-1] || `الجزء ${num}`
  }
  const filtered = useMemo(() => {
    if (!thumuns.length) return []
    // Guest free mode on landing
    if (!user) {
      if (guestMode === 'juz' && juz) return thumuns.filter(t => t.juz === Number(juz))
      if (guestMode === 'five_hizb' && guestFiveHizb) return thumuns.filter(t => fiveHizbGroupOf(t.hizb) === Number(guestFiveHizb))
      if (guestMode === 'quarter' && guestQuarter) return thumuns.filter(t => Number(t.quranQuarter || Math.floor((t.id-1)/120)+1) === Number(guestQuarter))
      if (guestMode === 'half' && guestHalf) return thumuns.filter(t => Number(t.quranHalf || Math.floor((t.id-1)/240)+1) === Number(guestHalf))
      if (guestMode === 'full') return thumuns
      return thumuns.filter(t => t.naqza === Number(naqza))
    }
    // Logged-in Freestyle should follow the same guestMode logic
    if (view === 'freestyle') {
      if (guestMode === 'juz' && juz) return thumuns.filter(t => t.juz === Number(juz))
      if (guestMode === 'five_hizb' && guestFiveHizb) return thumuns.filter(t => fiveHizbGroupOf(t.hizb) === Number(guestFiveHizb))
      if (guestMode === 'quarter' && guestQuarter) return thumuns.filter(t => Number(t.quranQuarter || Math.floor((t.id-1)/120)+1) === Number(guestQuarter))
      if (guestMode === 'half' && guestHalf) return thumuns.filter(t => Number(t.quranHalf || Math.floor((t.id-1)/240)+1) === Number(guestHalf))
      if (guestMode === 'full') return thumuns
      return thumuns.filter(t => t.naqza === Number(naqza))
    }
    // Default (e.g., Test view) uses student's current naqza unless a juz is chosen
    if (juz) return thumuns.filter(t => t.juz === Number(juz))
    return thumuns.filter(t => t.naqza === Number(naqza))
  }, [thumuns, naqza, juz, user, view, guestMode, guestFiveHizb, guestQuarter, guestHalf])

  function pickRandom() {
    if (!filtered.length) return
    // Avoid immediate repeat if possible
    const pool = current ? filtered.filter(t => t.id !== current.id) : filtered
    const base = pool.length ? pool : filtered
    const idx = Math.floor(Math.random() * base.length)
    setCurrent(base[idx])
  }

  // Reset current selection whenever filtering inputs change (so it can't stay stuck on an old mode)
  useEffect(() => { setCurrent(null) }, [view, guestMode, naqza, juz, guestFiveHizb, guestQuarter, guestHalf, thumuns])

  return (
    <>
    <div className="container">
      <div className="brand" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
        <button className="brand-link" onClick={() => setView('dashboard')} aria-label="الصفحة الرئيسية">
          <img className="app-logo" src={theme === 'dark' ? '/quran-white.png' : '/quran.png'} alt="شعار التطبيق" width="56" height="56" style={{ borderRadius: 8, background:'transparent' }} />
        </button>
        <button className="brand-link" onClick={() => setView('dashboard')} aria-label="الذهاب إلى لوحة التحكم">
          <h1 className="hero-title" style={{ marginBottom: 0, background:'transparent' }}>اختبار الحلقة</h1>
        </button>
      </div>

      <button aria-label="تبديل الوضع" className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ display: drawerOpen ? 'none' : undefined }}>
        {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
      </button>
      <button className="menu-toggle" onClick={() => setDrawerOpen(true)} aria-label="القائمة" style={{ display: drawerOpen ? 'none' : undefined }}>
        ☰
      </button>

      {!user ? (
        view === 'reset' ? (
          <ResetPassword />
        ) : (
        <div className="stage" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 16, minHeight: '70vh' }}>
          {/* Free randomizer for guests */}
          <div className="controls" style={{ maxWidth: 720, width: '100%', display:'grid', gridTemplateColumns:'1fr', justifyItems:'center', gap:10 }}>
            <label aria-label="الوضع">
              الوضع:
              <select value={guestMode} onChange={e => { setGuestMode(e.target.value); setJuz(''); setGuestFiveHizb(''); setGuestQuarter(''); setGuestHalf(''); setCurrent(null) }} className="input" style={{ width: 240 }}>
                <option value="naqza">حسب النقزة</option>
                <option value="juz">حسب الجزء</option>
                <option value="five_hizb">خمسة أحزاب</option>
                <option value="quarter">ربع القرآن</option>
                <option value="half">نصف القرآن</option>
                <option value="full">القرآن كامل</option>
              </select>
              <div className="hint">اختر طريقة التصفية المناسبة</div>
            </label>
            {guestMode === 'naqza' && (
              <label aria-label="النقزة">
                النقزة:
                <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} className="input" style={{ width: 260 }}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{`${n} - ${NAQZA_LABELS[n-1]}`}</option>
                  ))}
                </select>
                <div className="hint">اختر النقزة الحالية للطالب</div>
              </label>
            )}
            {guestMode === 'juz' && (
              <label aria-label="الجزء">
                الجزء:
                <select value={juz} onChange={e => setJuz(e.target.value)} className="input" style={{ width: 200 }}>
                  <option value="">—</option>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{`${n} - ${JUZ_NAMES[n-1]}`}</option>
                  ))}
                </select>
                <div className="hint">اختر رقم الجزء</div>
              </label>
            )}
            {guestMode === 'five_hizb' && (
              <label aria-label="خمسة أحزاب">
                المجموعة:
                <select value={guestFiveHizb} onChange={e => setGuestFiveHizb(e.target.value)} className="input" style={{ width: 220 }}>
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{`الأحزاب ${((n-1)*5+1)}–${n*5}`}</option>
                  ))}
                </select>
                <div className="hint">اختر مجموعة من ٥ أحزاب</div>
              </label>
            )}
            {guestMode === 'quarter' && (
              <label aria-label="ربع القرآن">
                الربع:
                <select value={guestQuarter} onChange={e => setGuestQuarter(e.target.value)} className="input" style={{ width: 220 }}>
                  <option value="">—</option>
                  <option value="1">الربع الأول</option>
                  <option value="2">الربع الثاني</option>
                  <option value="3">الربع الثالث</option>
                  <option value="4">الربع الرابع</option>
                </select>
                <div className="hint">اختر ربع القرآن</div>
              </label>
            )}
            {guestMode === 'half' && (
              <label aria-label="نصف القرآن">
                النصف:
                <select value={guestHalf} onChange={e => setGuestHalf(e.target.value)} className="input" style={{ width: 220 }}>
                  <option value="">—</option>
                  <option value="1">النصف الأول</option>
                  <option value="2">النصف الثاني</option>
                </select>
                <div className="hint">اختر نصف القرآن</div>
              </label>
            )}
            <button className="btn btn--primary" style={{ gridColumn: '1 / -1', justifySelf:'center' }} onClick={pickRandom} disabled={loading || !filtered.length}>اختر ثُمُناً عشوائياً</button>
          </div>
          <div className="meta" style={{ marginTop: 8 }}>{loading ? 'جاري التحميل…' : (filtered.length ? `عدد الأثمان المتاحة: ${filtered.length.toLocaleString('ar-EG-u-nu-latn')}` : 'لا توجد أثمان متاحة')}</div>
          {current && (
            <div ref={resultRef} className={`card appear ${highlight ? 'pulse-outline' : ''}`} style={{ marginTop: 16, maxWidth: 720 }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>الثُمُن رقم {current.id}</div>
              <div className="phrase">{current.name || '—'}</div>
              <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:4 }}>
                <button className="btn" onClick={pickRandom}>اختيار جديد</button>
              </div>
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
        )
      ) : (
        <div className="stage" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center' }}>
          {view === 'dashboard' && (
            <Dashboard />
          )}
          {view === 'students' && !selectedStudent && (
            <Students onSelect={(s) => { setSelectedStudent(s); setView('test') }} onProfile={(s) => { setSelectedStudent(s); setView('students') }} />
          )}
          {view === 'students' && selectedStudent && (
            <StudentProfile student={selectedStudent} onBack={() => setSelectedStudent(null)} />
          )}
          {view === 'test' && selectedStudent && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:8, justifyContent:'center' }}>
                <button className="btn" onClick={() => { setSelectedStudent(null); setView('students') }}>
                  ← الرجوع
                </button>
                <button className="btn" onClick={() => setView('students')}>
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
          {view === 'freestyle' && (
            <div className="stage" style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingInline: 16, minHeight: '70vh' }}>
              {/* Reuse the guest-mode randomizer UI for logged-in users */}
              <div className="controls" style={{ maxWidth: 720, width: '100%', display:'grid', gridTemplateColumns:'1fr', justifyItems:'center', gap:10 }}>
                <label aria-label="الوضع">
                  الوضع:
                  <select value={guestMode} onChange={e => { setGuestMode(e.target.value); setJuz(''); setGuestFiveHizb(''); setGuestQuarter(''); setGuestHalf(''); setCurrent(null) }} className="input" style={{ width: 240 }}>
                    <option value="naqza">حسب النقزة</option>
                    <option value="juz">حسب الجزء</option>
                    <option value="five_hizb">خمسة أحزاب</option>
                    <option value="quarter">ربع القرآن</option>
                    <option value="half">نصف القرآن</option>
                    <option value="full">القرآن كامل</option>
                  </select>
                  <div className="hint">اختر طريقة التصفية المناسبة</div>
                </label>
                {guestMode === 'naqza' && (
                  <label aria-label="النقزة">
                    النقزة:
                    <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} className="input" style={{ width: 260 }}>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{`${n} - ${NAQZA_LABELS[n-1]}`}</option>
                      ))}
                    </select>
                    <div className="hint">اختر النقزة</div>
                  </label>
                )}
                {guestMode === 'juz' && (
                  <label aria-label="الجزء">
                    الجزء:
                    <select value={juz} onChange={e => setJuz(e.target.value)} className="input" style={{ width: 200 }}>
                      <option value="">—</option>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{`${n} - ${JUZ_NAMES[n-1]}`}</option>
                      ))}
                    </select>
                    <div className="hint">اختر رقم الجزء</div>
                  </label>
                )}
                {guestMode === 'five_hizb' && (
                  <label aria-label="خمسة أحزاب">
                    المجموعة:
                    <select value={guestFiveHizb} onChange={e => setGuestFiveHizb(e.target.value)} className="input" style={{ width: 220 }}>
                      <option value="">—</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{`الأحزاب ${((n-1)*5+1)}–${n*5}`}</option>
                      ))}
                    </select>
                    <div className="hint">اختر مجموعة ٥ أحزاب</div>
                  </label>
                )}
                {guestMode === 'quarter' && (
                  <label aria-label="ربع القرآن">
                    الربع:
                    <select value={guestQuarter} onChange={e => setGuestQuarter(e.target.value)} className="input" style={{ width: 220 }}>
                      <option value="">—</option>
                      <option value="1">الربع الأول</option>
                      <option value="2">الربع الثاني</option>
                      <option value="3">الربع الثالث</option>
                      <option value="4">الربع الرابع</option>
                    </select>
                    <div className="hint">اختر ربع القرآن</div>
                  </label>
                )}
                {guestMode === 'half' && (
                  <label aria-label="نصف القرآن">
                    النصف:
                    <select value={guestHalf} onChange={e => setGuestHalf(e.target.value)} className="input" style={{ width: 220 }}>
                      <option value="">—</option>
                      <option value="1">النصف الأول</option>
                      <option value="2">النصف الثاني</option>
                    </select>
                    <div className="hint">اختر نصف القرآن</div>
                  </label>
                )}
                <button className="btn btn--primary" style={{ gridColumn: '1 / -1', justifySelf:'center' }} onClick={pickRandom} disabled={loading || !filtered.length}>اختر ثُمُناً عشوائياً</button>
              </div>
              <div className="meta" style={{ marginTop: 8 }}>{loading ? 'جاري التحميل…' : (filtered.length ? `عدد الأثمان المتاحة: ${filtered.length.toLocaleString('ar-EG-u-nu-latn')}` : 'لا توجد أثمان متاحة')}</div>
              {current && (
                <div ref={resultRef} className={`card appear ${highlight ? 'pulse-outline' : ''}`} style={{ marginTop: 16, maxWidth: 720 }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>الثُمُن رقم {current.id}</div>
                  <div className="phrase">{current.name || '—'}</div>
                  <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:4 }}>
                    <button className="btn" onClick={pickRandom}>اختيار جديد</button>
                  </div>
                  <div className="info-grid">
                    <Info label="السورة" value={`${current.surah || '—'}${current.surahNumber ? ` (رقم ${current.surahNumber})` : ''}`} />
                    <Info label="الحزب" value={current.hizb ?? '—'} />
                    <Info label="الربع" value={current.quarter ?? '—'} />
                    <Info label="الجزء" value={current.juz ? `${current.juz} - ${juzName(current.juz)}` : '—'} />
                    <Info label="النقزة" value={current.naqza ? `${current.naqza} - ${naqzaName(current.naqza)}` : '—'} />
                  </div>
                </div>
              )}
            </div>
          )}
          {view === 'about' && (
            <About onBack={() => setView('dashboard')} />
          )}
          {view === 'privacy' && (
            <Privacy onBack={() => setView('dashboard')} />
          )}
          {view === 'reset' && (
            <ResetPassword />
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
