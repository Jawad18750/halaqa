import { useState } from 'react'
import { auth } from '../api'

export default function Auth({ onAuthed }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const { user } = await (mode === 'login'
        ? auth.login(username.trim(), password.trim())
        : auth.register(username.trim(), password.trim(), email.trim()))
      onAuthed(user)
    } catch (e) {
      const msg = String(e?.message || '')
      if (/load failed|failed to fetch|networkerror|network error/i.test(msg)) {
        setError('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.')
      } else {
        setError(msg || 'حدث خطأ غير متوقع')
      }
    }
  }

  return (
    <div className="auth-card">
      <h2 style={{ margin: '0 0 16px', fontSize: 'var(--text-xl)' }}>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="field__label">اسم المستخدم</span>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        {mode === 'register' && (
          <label className="field">
            <span className="field__label">البريد الإلكتروني</span>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </label>
        )}
        <label className="field">
          <span className="field__label">كلمة المرور</span>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <button type="submit" className="btn btn--primary" style={{ width: '100%' }}>{mode === 'login' ? 'دخول' : 'تسجيل'}</button>
        <button type="button" className="btn btn--ghost" style={{ width: '100%' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب؟ دخول'}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn btn--ghost" style={{ width: '100%' }} onClick={() => setForgot(true)}>نسيت كلمة المرور؟</button>
        )}
      </form>
      {forgot && (
        <form onSubmit={async (e) => { e.preventDefault(); setError(''); setForgotMsg(''); try { await auth.forgot(forgotEmail.trim()); setForgotMsg('تم إرسال رابط الاستعادة (إن وُجد) إلى بريدك.'); } catch (err) { setError(err.message) } }} className="stack" style={{ marginTop: 16 }}>
          <label className="field">
            <span className="field__label">البريد الإلكتروني</span>
            <input className="input" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoComplete="email" required />
          </label>
          {forgotMsg && <div className="alert alert--success">{forgotMsg}</div>}
          <div className="cluster">
            <button className="btn btn--primary" type="submit" style={{ flex: 1 }}>إرسال الرابط</button>
            <button className="btn" type="button" onClick={() => { setForgot(false); setForgotEmail(''); setForgotMsg('') }} style={{ flex: 1 }}>إغلاق</button>
          </div>
        </form>
      )}
    </div>
  )
}
