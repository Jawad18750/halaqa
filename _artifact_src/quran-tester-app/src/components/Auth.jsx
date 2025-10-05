import { useState } from 'react'
import { auth } from '../api'

export default function Auth({ onAuthed }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const fn = mode === 'login' ? auth.login : auth.register
      const { user } = await fn(username.trim(), password.trim())
      onAuthed(user)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ maxWidth: 380, width: '100%', margin: 0, padding: 8 }}>
      <h2 style={{ margin: '6px 0 12px' }}>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
      <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'1fr', gap: 10 }}>
        <label style={{ display:'grid', gap:6 }}>
          <span style={{ fontSize:13, color:'var(--muted)' }}>اسم المستخدم</span>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} required />
        </label>
        <label style={{ display:'grid', gap:6 }}>
          <span style={{ fontSize:13, color:'var(--muted)' }}>كلمة المرور</span>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        <button type="submit" className="btn btn--primary" style={{ width:'100%' }}>{mode === 'login' ? 'دخول' : 'تسجيل'}</button>
        <button type="button" className="btn" style={{ width:'100%' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب؟ دخول'}
        </button>
      </form>
    </div>
  )
}

