import { useState, useEffect } from 'react'
import { auth } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'

export default function ResetPassword({ onBack }) {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '')
  }, [])

  async function submit(e) {
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
    <div className="auth-card">
      {onBack && (
        <PageHeader title="إعادة تعيين كلمة المرور" onBack={onBack} />
      )}
      <SectionCard title={onBack ? undefined : 'إعادة تعيين كلمة المرور'}>
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span className="field__label">كلمة المرور الجديدة</span>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
          </label>
          <label className="field">
            <span className="field__label">تأكيد كلمة المرور</span>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
          </label>
          {err && <div className="alert alert--error">{err}</div>}
          {msg && <div className="alert alert--success">{msg}</div>}
          <button type="submit" className="btn btn--primary">حفظ</button>
        </form>
      </SectionCard>
    </div>
  )
}
