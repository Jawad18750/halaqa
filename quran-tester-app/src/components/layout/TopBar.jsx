import { VIEW_TITLES } from '../../lib/labels.js'

export default function TopBar({ theme, view, user, onBrandClick, onMenuClick, onThemeToggle, drawerOpen }) {
  const pageTitle = user ? (VIEW_TITLES[view] || '') : 'الوضع الحر'

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
          {pageTitle && <span className="topbar__page-title">{pageTitle}</span>}
        </div>
      </button>
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar-btn"
          aria-label="تبديل الوضع"
          onClick={onThemeToggle}
          style={{ display: drawerOpen ? 'none' : undefined }}
        >
          {theme === 'dark' ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
        </button>
        <button
          type="button"
          className="topbar-btn"
          aria-label="القائمة"
          onClick={onMenuClick}
          style={{ display: drawerOpen ? 'none' : undefined }}
        >
          <i className="fa-solid fa-bars" />
        </button>
      </div>
    </header>
  )
}
