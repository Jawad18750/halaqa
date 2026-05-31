import { useEffect, useRef } from 'react'
import Auth from './Auth'
import { useMotionMount } from '../lib/useMotionMount.js'

const NAV_GROUPS = [
  {
    label: 'عمل يومي',
    items: [
      { view: 'dashboard', icon: 'fa-gauge', label: 'الرئيسية' },
      { view: 'students', icon: 'fa-users', label: 'الطلاب' },
      { view: 'guardians', icon: 'fa-user-group', label: 'أولياء الأمور' },
      { view: 'freestyle', icon: 'fa-wand-magic-sparkles', label: 'الوضع الحر' },
    ],
  },
  {
    label: 'تقارير',
    items: [
      { view: 'weekly', icon: 'fa-calendar-week', label: 'نظرة زمنية' },
      { view: 'leaderboard', icon: 'fa-trophy', label: 'لوحة الصدارة' },
    ],
  },
  {
    label: 'إعدادات',
    items: [
      { view: 'settings', icon: 'fa-gear', label: 'إعدادات الحلقة' },
      { view: 'backup', icon: 'fa-cloud-arrow-down', label: 'النسخ الاحتياطي' },
      { view: 'broadcast', icon: 'fa-paper-plane', label: 'رسائل Telegram' },
      { view: 'about', icon: 'fa-circle-info', label: 'عن التطبيق' },
      { view: 'privacy', icon: 'fa-user-shield', label: 'الخصوصية' },
    ],
  },
]

export default function Drawer({ open, onClose, user, currentView, onAuthed, onNavigate, onLogout }) {
  const { render, active } = useMotionMount(open)
  const drawerRef = useRef(null)
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (active) {
      closeBtnRef.current?.focus()
      return
    }
    const root = drawerRef.current
    if (root?.contains(document.activeElement)) {
      document.activeElement.blur()
    }
  }, [active])

  if (!render) return null

  return (
    <>
      <div
        className={`drawer-overlay ${active ? 'drawer-overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`drawer ${active ? 'drawer--visible' : ''}`}
        role="dialog"
        aria-modal={active ? 'true' : undefined}
        aria-label="القائمة"
        {...(!active && { inert: true })}
      >
        <header className="drawer-header">
          <strong>القائمة</strong>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label="إغلاق"
            tabIndex={active ? 0 : -1}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        {!user ? (
          <div className="drawer-inner">
            <Auth onAuthed={u => { onAuthed(u); onClose() }} />
          </div>
        ) : (
          <>
            <div className="drawer-user">
              <div className="drawer-user__avatar">
                <i className="fa-solid fa-user" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{user.username}</div>
                <div className="meta">{user.email || 'معلّم'}</div>
              </div>
            </div>
            <div className="drawer-inner">
              {NAV_GROUPS.map(group => (
                <nav key={group.label} className="nav-group" aria-label={group.label}>
                  <div className="nav-group__label">{group.label}</div>
                  <div className="nav-list">
                    {group.items.map(item => (
                      <button
                        key={item.view}
                        type="button"
                        className={`nav-item ${currentView === item.view ? 'nav-item--active' : ''}`}
                        onClick={() => { onNavigate(item.view); onClose() }}
                      >
                        <i className={`fa-solid ${item.icon}`} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>
              ))}
              <button type="button" className="nav-item" onClick={() => { onLogout(); onClose() }} style={{ marginTop: 8, color: 'var(--danger)' }}>
                <i className="fa-solid fa-right-from-bracket" />
                تسجيل الخروج
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
