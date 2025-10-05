import { useState, useEffect } from 'react'
import { auth } from '../api'

export default function ResetPassword() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const t = p.get('token') || ''
    setToken(t)
  }, [])

  async function submit(e){
    e.preventDefault()
    setErr(''); setMsg('')
    if (!token) return setErr('الرابط غير صالح')
    if (!password || password.length < 6) return setErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
    if (password !== confirm) return setErr('كلمتا المرور غير متطابقتين')
    try {
      await auth.reset(token, password)
      setMsg('تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.')
      setTimeout(() => { window.location.href = '/' }, 1200)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card appear" style={{ display:'grid', gap:10 }}>
        <h2 style={{ textAlign:'center', margin: 0 }}>إعادة تعيين كلمة المرور</h2>
        <form onSubmit={submit} style={{ display:'grid', gap:10 }}>
          <label style={{ display:'grid', gap:6 }}>
            <span style={{ fontSize:13, color:'var(--muted)' }}>كلمة المرور الجديدة</span>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          <label style={{ display:'grid', gap:6 }}>
            <span style={{ fontSize:13, color:'var(--muted)' }}>تأكيد كلمة المرور</span>
            <input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          </label>
          {err && <div style={{ color:'crimson' }}>{err}</div>}
          {msg && <div style={{ color:'seagreen' }}>{msg}</div>}
          <button className="btn btn--primary" type="submit">حفظ</button>
        </form>
      </div>
    </div>
  )
}


