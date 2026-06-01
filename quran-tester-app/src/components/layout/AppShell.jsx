import { useEffect } from 'react'
import TopBar from './TopBar.jsx'
import A11yPanel from './A11yPanel.jsx'
import SiteFooter from './SiteFooter.jsx'
import Drawer from '../Drawer.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'

export default function AppShell({
  theme,
  view,
  user,
  contextLabel,
  drawerOpen,
  onBrandClick,
  onMenuClick,
  onThemeToggle,
  onDrawerClose,
  onAuthed,
  onNavigate,
  onLogout,
  fontScale,
  highContrast,
  onFontScaleChange,
  onContrastChange,
  wide,
  children,
}) {
  useEffect(() => {
    if (!drawerOpen) return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape') onDrawerClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen, onDrawerClose])

  return (
    <div className="app-shell">
      <TopBar
        theme={theme}
        view={view}
        user={user}
        contextLabel={contextLabel}
        onBrandClick={onBrandClick}
        onMenuClick={onMenuClick}
        onThemeToggle={onThemeToggle}
        drawerOpen={drawerOpen}
      />
      <main className={`app-main ${wide ? 'app-main--wide' : ''}`}>
        {children}
        <SiteFooter />
      </main>
      <Drawer
        open={drawerOpen}
        onClose={onDrawerClose}
        user={user}
        currentView={view}
        onAuthed={onAuthed}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <A11yPanel
        fontScale={fontScale}
        highContrast={highContrast}
        onFontScaleChange={onFontScaleChange}
        onContrastChange={onContrastChange}
      />
      <ConfirmDialog />
    </div>
  )
}
