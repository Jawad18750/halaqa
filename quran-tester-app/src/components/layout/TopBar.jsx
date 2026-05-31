import { VIEW_TITLES } from '../../lib/labels.js'

export default function TopBar({ theme, view, user, contextLabel, onBrandClick, onMenuClick, onThemeToggle, drawerOpen }) {
  const pageTitle = user
    ? (contextLabel || VIEW_TITLES[view] || '')
    : ''

  const subtitleKey = user ? (contextLabel ? `ctx:${contextLabel}` : view) : 'guest'

  return (
    <header className="topbar">
      <button type="button" className="topbar__brand" onClick={onBrandClick} aria-label="الصفحة الرئيسية">
        <img
          className="topbar__logo"
          src={theme === 'dark' ? '/quran-white.png' : '/quran.png'}
          alt=""
          width={36}
          height={36}
        />
        <div className="topbar__titles">
          <span className="topbar__app-name">اختبار الحلقة</span>
          {pageTitle && (
            <span key={subtitleKey} className="topbar__page-title motion-title">{pageTitle}</span>
          )}
        </div>
      </button>
      <div className="topbar__actions">
        <button
          type="button"
          className={`topbar-btn topbar-btn--theme ${drawerOpen ? 'topbar-btn--drawer-hidden' : ''}`}
          aria-label="تبديل الوضع"
          aria-hidden={drawerOpen}
          tabIndex={drawerOpen ? -1 : 0}
          onClick={onThemeToggle}
        >
          {theme === 'dark' ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
        </button>
        <button
          type="button"
          className={`topbar-btn ${drawerOpen ? 'topbar-btn--menu-open' : ''}`}
          aria-label={drawerOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={drawerOpen}
          onClick={onMenuClick}
        >
          <i className={`fa-solid ${drawerOpen ? 'fa-xmark' : 'fa-bars'}`} />
        </button>
      </div>
    </header>
  )
}
