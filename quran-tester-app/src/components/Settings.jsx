import { useEffect, useState } from 'react'
import { auth } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'

export default function Settings({ user, onBack, onSaved }) {
  const [sheikhName, setSheikhName] = useState(user?.sheikh_name || '')
  const [masjidName, setMasjidName] = useState(user?.masjid_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    setSheikhName(user?.sheikh_name || '')
    setMasjidName(user?.masjid_name || '')
  }, [user?.sheikh_name, user?.masjid_name])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await auth.updateSettings({
        sheikh_name: sheikhName.trim(),
        masjid_name: masjidName.trim(),
      })
      onSaved?.(updated)
      setToast('تم حفظ الإعدادات')
    } catch (err) {
      setError(err.message || 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack settings-page">
      <PageHeader title="إعدادات الحلقة" subtitle="تظهر في دعوات Telegram ورسائل النتائج" onBack={onBack} />

      {toast && (
        <div className="alert alert--success" role="status">
          {toast}
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}

      <SectionCard title="بيانات الحلقة">
        <form className="stack settings-form" onSubmit={handleSave}>
          <label className="field">
            <span className="field__label">اسم الشيخ</span>
            <input
              className="input"
              value={sheikhName}
              onChange={e => setSheikhName(e.target.value)}
              placeholder="مثال: الشيخ أحمد محمد"
              autoFocus
            />
            <span className="field__hint">يُذكر في رسائل الدعوة ونتائج الاختبار.</span>
          </label>

          <label className="field">
            <span className="field__label">اسم المسجد / الحلقة</span>
            <input
              className="input"
              value={masjidName}
              onChange={e => setMasjidName(e.target.value)}
              placeholder="مثال: مسجد النور — حلقة بعد المغرب"
            />
            <span className="field__hint">يُذكر مع اسم الشيخ في الرسائل المرسلة لأولياء الأمور.</span>
          </label>

          <div className="settings-preview">
            <p className="settings-preview__label meta">معاينة التوقيع في الرسائل</p>
            <div className="settings-preview__box">
              {masjidName.trim() && <p>🕌 {masjidName.trim()}</p>}
              {sheikhName.trim() && <p>👤 الشيخ: {sheikhName.trim()}</p>}
              {!masjidName.trim() && !sheikhName.trim() && (
                <p className="meta">أدخل الاسم والمسجد ليظهر التوقيع في الرسائل.</p>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
          </button>
        </form>
      </SectionCard>
    </div>
  )
}
