import { useEffect, useState } from 'react'
import Students from './components/Students'
import StudentProfile from './components/StudentProfile'
import TestView from './components/TestView'
import StudentHistory from './components/StudentHistory'
import WeeklyOverview from './components/WeeklyOverview'
import WeeklyLeaderboard from './components/WeeklyLeaderboard'
import Dashboard from './components/Dashboard'
import About from './components/About'
import Privacy from './components/Privacy'
import ResetPassword from './components/ResetPassword'
import Backup from './components/Backup'
import FreestyleRandomizer from './components/FreestyleRandomizer'
import AppShell from './components/layout/AppShell'
import { auth, getToken } from './api'

try {
  const initialTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.dataset.theme = initialTheme
  document.documentElement.style.setProperty('--font-scale', String(Number(localStorage.getItem('fontScale') || 1)))
  document.documentElement.dataset.contrast = localStorage.getItem('contrast') === '1' ? 'high' : 'normal'
} catch {}

const WIDE_VIEWS = new Set(['dashboard', 'leaderboard', 'weekly'])

export default function App() {
  const [user, setUser] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [view, setView] = useState('dashboard')
  const [returnView, setReturnView] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [thumuns, setThumuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('fontScale') || 1))
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('contrast') === '1')

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.lang = 'ar'
  }, [])

  useEffect(() => {
    if (window.location.pathname.startsWith('/reset')) setView('reset')
  }, [])

  useEffect(() => {
    if (getToken()) auth.me().then(({ user: u }) => setUser(u)).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    const link = document.querySelector("link[rel='icon']")
    if (link) link.href = theme === 'dark' ? '/quran-white.png' : '/quran.png'
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
    fetch('/quran-thumun-data.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(d => setThumuns(d.thumuns || []))
      .finally(() => setLoading(false))
  }, [])

  function navigate(v) {
    setView(v)
  }

  function goDashboard() {
    setView('dashboard')
    setSelectedStudent(null)
    setReturnView(null)
  }

  function openStudent(student, target = 'students') {
    const fromStudentsList = view === 'students' && !selectedStudent
    if (fromStudentsList) {
      setReturnView(null)
    } else if (['dashboard', 'leaderboard', 'weekly'].includes(view)) {
      setReturnView(view)
    }
    setSelectedStudent(student)
    setView(target)
  }

  function goStudentsList() {
    setSelectedStudent(null)
    setView('students')
    setReturnView(null)
  }

  function goStudentProfile() {
    setView('students')
  }

  function handleProfileBack() {
    if (returnView) {
      setView(returnView)
      setSelectedStudent(null)
      setReturnView(null)
      return
    }
    goStudentsList()
  }

  function goHomeFromReset() {
    if (window.location.pathname.startsWith('/reset')) {
      window.history.replaceState({}, '', '/')
    }
    setView('dashboard')
  }

  function logout() {
    auth.logout()
    setUser(null)
    setView('dashboard')
    setSelectedStudent(null)
  }

  function renderContent() {
    if (view === 'reset') {
      return (
        <div key="reset" className="page motion-page">
          <ResetPassword onBack={goHomeFromReset} />
        </div>
      )
    }

    const viewKey = !user
      ? 'guest'
      : selectedStudent
        ? `${view}:${selectedStudent.id}`
        : view

    if (!user) {
      return (
        <div key={viewKey} className="page motion-page">
          <FreestyleRandomizer thumuns={thumuns} loading={loading} theme={theme} onSignIn={() => setDrawerOpen(true)} />
        </div>
      )
    }

    return (
      <div key={viewKey} className={`page motion-page ${WIDE_VIEWS.has(view) ? 'page--wide' : ''}`}>
        {view === 'dashboard' && (
          <Dashboard onNavigate={navigate} onOpenStudent={openStudent} />
        )}
        {view === 'students' && !selectedStudent && (
          <Students
            onSelect={s => openStudent(s, 'test')}
            onProfile={s => openStudent(s, 'students')}
          />
        )}
        {view === 'students' && selectedStudent && (
          <StudentProfile
            student={selectedStudent}
            thumuns={thumuns}
            onBack={handleProfileBack}
            onTest={() => setView('test')}
            onHistory={() => setView('studentHistory')}
            onStudentUpdated={setSelectedStudent}
          />
        )}
        {view === 'test' && selectedStudent && (
          <TestView
            student={selectedStudent}
            thumuns={thumuns}
            onGoProfile={goStudentProfile}
            onTestAgain={() => setView('test')}
            onGoList={goStudentsList}
            onHistory={() => setView('studentHistory')}
            onBack={goStudentProfile}
            onStudentUpdated={setSelectedStudent}
          />
        )}
        {view === 'studentHistory' && selectedStudent && (
          <StudentHistory
            student={selectedStudent}
            thumuns={thumuns}
            onBack={goStudentProfile}
            onTest={() => setView('test')}
            onProfile={goStudentProfile}
          />
        )}
        {view === 'weekly' && <WeeklyOverview onBack={goDashboard} />}
        {view === 'leaderboard' && (
          <WeeklyLeaderboard onBack={goDashboard} onOpenStudent={openStudent} />
        )}
        {view === 'freestyle' && (
          <FreestyleRandomizer thumuns={thumuns} loading={loading} theme={theme} onBack={goDashboard} />
        )}
        {view === 'about' && <About onBack={goDashboard} />}
        {view === 'privacy' && <Privacy onBack={goDashboard} />}
        {view === 'backup' && <Backup onBack={goDashboard} />}
      </div>
    )
  }

  const contextLabel = selectedStudent && ['test', 'students', 'studentHistory'].includes(view)
    ? selectedStudent.name
    : null

  return (
    <AppShell
      theme={theme}
      view={view}
      user={user}
      contextLabel={contextLabel}
      drawerOpen={drawerOpen}
      wide={WIDE_VIEWS.has(view)}
      onBrandClick={goDashboard}
      onMenuClick={() => setDrawerOpen(open => !open)}
      onThemeToggle={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      onDrawerClose={() => setDrawerOpen(false)}
      onAuthed={setUser}
      onNavigate={navigate}
      onLogout={logout}
      fontScale={fontScale}
      highContrast={highContrast}
      onFontScaleChange={setFontScale}
      onContrastChange={setHighContrast}
    >
      {renderContent()}
    </AppShell>
  )
}
