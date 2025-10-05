import { useState } from 'react'
import Auth from './Auth'

export default function Drawer({ open, onClose, user, onAuthed, onNavigate, onLogout }) {
  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      {open && (
        <aside className="drawer" role="dialog" aria-modal="true">
          <header className="drawer-header">
            <strong>القائمة</strong>
            <button className="btn btn--ghost" onClick={onClose} aria-label="إغلاق">×</button>
          </header>
          <div className="drawer-inner">
            <div style={{ borderTop:'1px solid var(--card-border)', margin:'6px 0 12px', opacity:.6 }} />
            {!user ? (
              <Auth onAuthed={(u) => { onAuthed(u); onClose(); }} />
            ) : (
              <nav className="nav-list" style={{ display:'grid', gap:8 }}>
                <button className="btn" onClick={() => { onNavigate('dashboard'); onClose(); }}>
                  <i className="fa-solid fa-gauge" style={{ marginInlineStart:6 }}></i> الرئيسية
                </button>
                <button className="btn" onClick={() => { onNavigate('students'); onClose(); }}>
                  <i className="fa-solid fa-users" style={{ marginInlineStart:6 }}></i> الطلاب
                </button>
                <button className="btn" onClick={() => { onNavigate('weekly'); onClose(); }}>
                  <i className="fa-solid fa-calendar-week" style={{ marginInlineStart:6 }}></i> نظرة زمنية
                </button>
                <button className="btn" onClick={() => { onNavigate('about'); onClose(); }}>
                  <i className="fa-solid fa-circle-info" style={{ marginInlineStart:6 }}></i> عن التطبيق
                </button>
                <button className="btn" onClick={() => { onNavigate('privacy'); onClose(); }}>
                  <i className="fa-solid fa-user-shield" style={{ marginInlineStart:6 }}></i> الخصوصية
                </button>
                <button className="btn btn--ghost" onClick={() => { onLogout(); onClose(); }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ marginInlineStart:6 }}></i> تسجيل الخروج
                </button>
              </nav>
            )}
          </div>
        </aside>
      )}
    </>
  )
}

