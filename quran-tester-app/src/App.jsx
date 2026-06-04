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
import GuardiansManage from './components/GuardiansManage'
import Broadcast from './components/Broadcast'
import AddStudent from './components/AddStudent'
import FreestyleRandomizer from './components/FreestyleRandomizer'
import Settings from './components/Settings'
import Attendance from './components/Attendance'
import QRPrint from './components/QRPrint'
import AttendanceOverview from './components/AttendanceOverview'
import AppShell from './components/layout/AppShell'
import { MessageSettingsProvider } from './lib/MessageSettingsContext.jsx'
import { auth, getToken } from './api'

try {
  const initialTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.dataset.theme = initialTheme
  document.documentElement.style.setProperty('--font-scale', String(Number(localStorage.getItem('fontScale') || 1)))
  document.documentElement.dataset.contrast = localStorage.getItem('contrast') === '1' ? 'high' : 'normal'
} catch {
  // Ignore storage access failures during early app boot.
}

const WIDE_VIEWS = new Set(['dashboard', 'leaderboard', 'weekly', 'attendance', 'attendanceLog', 'qrcodes'])

export default function App() {
  const [user, setUser] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [view, setView] = useState('dashboard')
  const [returnView, setReturnView] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [thumuns, setThumuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [studentsListFocus, setStudentsListFocus] = useState(null)
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
    const iconHref = theme === 'dark' ? '/quran-white.png' : '/quran.png'
    document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon'][sizes='512x512']").forEach((link) => {
      link.href = iconHref
    })
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
    setStudentsListFocus(null)
    setView('students')
    setReturnView(null)
  }

  function goStudentsWithoutGuardian() {
    setSelectedStudent(null)
    setStudentsListFocus('no-guardian')
    setView('students')
    setReturnView(null)
  }

  function goAddStudent() {
    setView('addStudent')
    setSelectedStudent(null)
  }

  function goBackFromAddStudent() {
    goStudentsList()
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
          <Dashboard
            onNavigate={navigate}
            onOpenStudent={openStudent}
            onAddStudent={goAddStudent}
            onStudentsWithoutGuardian={goStudentsWithoutGuardian}
          />
        )}
        {view === 'students' && !selectedStudent && (
          <Students
            onSelect={s => openStudent(s, 'test')}
            onProfile={s => openStudent(s, 'students')}
            onAddStudent={goAddStudent}
            onNavigate={navigate}
            onPrintQr={() => navigate('qrcodes')}
            listFocus={studentsListFocus}
            onListFocusConsumed={() => setStudentsListFocus(null)}
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
        {view === 'settings' && (
          <Settings user={user} onBack={goDashboard} onSaved={setUser} />
        )}
        {view === 'attendance' && (
          <Attendance onBack={goDashboard} onPrint={() => navigate('qrcodes')} />
        )}
        {view === 'attendanceLog' && (
          <AttendanceOverview onBack={goDashboard} thumuns={thumuns} />
        )}
        {view === 'qrcodes' && (
          <QRPrint user={user} onBack={goDashboard} />
        )}
        {view === 'guardians' && (
          <GuardiansManage onBack={goDashboard} onOpenStudent={openStudent} />
        )}
        {view === 'addStudent' && (
          <AddStudent
            thumuns={thumuns}
            onBack={goBackFromAddStudent}
            onOpenStudent={openStudent}
            onNavigate={navigate}
          />
        )}
        {view === 'broadcast' && <Broadcast onBack={goDashboard} />}
      </div>
    )
  }

  const contextLabel = selectedStudent && ['test', 'students', 'studentHistory'].includes(view)
    ? selectedStudent.name
    : null

  return (
    <MessageSettingsProvider user={user}>
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
    </MessageSettingsProvider>
  )
}
