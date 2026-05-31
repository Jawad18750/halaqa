import TopBar from './TopBar.jsx'
import A11yPanel from './A11yPanel.jsx'
import SiteFooter from './SiteFooter.jsx'
import Drawer from '../Drawer.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'

const BUILD_TAG = import.meta.env.VITE_BUILD_TAG || 'dev'

export default function AppShell({
  theme,
  view,
  user,
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
  return (
    <div className="app-shell">
      <TopBar
        theme={theme}
        view={view}
        user={user}
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
      <div className="build-tag">الإصدار: {BUILD_TAG}</div>
    </div>
  )
}
