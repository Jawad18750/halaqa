import { useEffect, useState } from 'react'
import { auth } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'

const WEEKDAYS = [
  { id: 'sat', label: 'السبت' },
  { id: 'sun', label: 'الأحد' },
  { id: 'mon', label: 'الإثنين' },
  { id: 'tue', label: 'الثلاثاء' },
  { id: 'wed', label: 'الأربعاء' },
  { id: 'thu', label: 'الخميس' },
  { id: 'fri', label: 'الجمعة' },
]

function normalizeOverrides(input) {
  const source = input && typeof input === 'object' ? input : {}
  return {
    open: source.open && typeof source.open === 'object' ? source.open : {},
    closed: source.closed && typeof source.closed === 'object' ? source.closed : {},
  }
}

export default function Settings({ user, onBack, onSaved }) {
  const [sheikhName, setSheikhName] = useState(user?.sheikh_name || '')
  const [masjidName, setMasjidName] = useState(user?.masjid_name || '')
  const [studyDays, setStudyDays] = useState(user?.study_days || ['sat', 'sun', 'mon', 'tue', 'wed'])
  const [libyaHolidays, setLibyaHolidays] = useState((user?.holiday_country || 'LY') !== 'none')
  const [holidayOverrides, setHolidayOverrides] = useState(() => normalizeOverrides(user?.holiday_overrides))
  const [closedDate, setClosedDate] = useState('')
  const [closedReason, setClosedReason] = useState('')
  const [openDate, setOpenDate] = useState('')
  const [openReason, setOpenReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    setSheikhName(user?.sheikh_name || '')
    setMasjidName(user?.masjid_name || '')
    setStudyDays(user?.study_days || ['sat', 'sun', 'mon', 'tue', 'wed'])
    setLibyaHolidays((user?.holiday_country || 'LY') !== 'none')
    setHolidayOverrides(normalizeOverrides(user?.holiday_overrides))
  }, [user?.sheikh_name, user?.masjid_name, user?.study_days, user?.holiday_country, user?.holiday_overrides])

  function toggleStudyDay(day) {
    setStudyDays(prev => {
      if (prev.includes(day)) {
        const next = prev.filter(item => item !== day)
        return next.length ? next : prev
      }
      return [...prev, day]
    })
  }

  function addOverride(type) {
    const date = type === 'closed' ? closedDate : openDate
    const reason = type === 'closed' ? closedReason : openReason
    if (!date) return
    setHolidayOverrides(prev => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [date]: { reason: reason.trim() } },
    }))
    if (type === 'closed') {
      setClosedDate('')
      setClosedReason('')
    } else {
      setOpenDate('')
      setOpenReason('')
    }
  }

  function removeOverride(type, date) {
    setHolidayOverrides(prev => {
      const nextType = { ...(prev[type] || {}) }
      delete nextType[date]
      return { ...prev, [type]: nextType }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await auth.updateSettings({
        sheikh_name: sheikhName.trim(),
        masjid_name: masjidName.trim(),
        study_days: studyDays,
        holiday_country: libyaHolidays ? 'LY' : 'none',
        holiday_overrides: holidayOverrides,
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

      <SectionCard title="أيام الدراسة والعطل">
        <form className="stack settings-form" onSubmit={handleSave}>
          <div className="field">
            <span className="field__label">أيام الدراسة</span>
            <div className="settings-days">
              {WEEKDAYS.map(day => (
                <button
                  key={day.id}
                  type="button"
                  className={`settings-day ${studyDays.includes(day.id) ? 'settings-day--active' : ''}`}
                  onClick={() => toggleStudyDay(day.id)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <span className="field__hint">الافتراضي من السبت إلى الأربعاء، ويمكن تغييره حسب نظام الحلقة.</span>
          </div>

          <label className="settings-toggle">
            <input type="checkbox" checked={libyaHolidays} onChange={e => setLibyaHolidays(e.target.checked)} />
            <span>
              <strong>احتساب عطل ليبيا الرسمية</strong>
              <small>يمكن تعديل الواقع بإضافة أيام فتح أو إغلاق مخصصة.</small>
            </span>
          </label>

          <div className="settings-holiday-grid">
            <div className="settings-holiday-box">
              <h3>أيام إغلاق مخصصة</h3>
              <div className="settings-holiday-form">
                <input className="input" type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)} />
                <input className="input" value={closedReason} onChange={e => setClosedReason(e.target.value)} placeholder="السبب" />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => addOverride('closed')}>إضافة</button>
              </div>
              <OverrideList rows={holidayOverrides.closed} type="closed" onRemove={removeOverride} />
            </div>

            <div className="settings-holiday-box">
              <h3>أيام فتح استثنائية</h3>
              <div className="settings-holiday-form">
                <input className="input" type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} />
                <input className="input" value={openReason} onChange={e => setOpenReason(e.target.value)} placeholder="السبب" />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => addOverride('open')}>إضافة</button>
              </div>
              <OverrideList rows={holidayOverrides.open} type="open" onRemove={removeOverride} />
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ إعدادات الأيام والعطل'}
          </button>
        </form>
      </SectionCard>
    </div>
  )
}

function OverrideList({ rows, type, onRemove }) {
  const entries = Object.entries(rows || {}).sort(([a], [b]) => a.localeCompare(b))
  if (!entries.length) return <p className="meta settings-empty">لا توجد تواريخ.</p>
  return (
    <div className="settings-override-list">
      {entries.map(([date, value]) => (
        <div key={date} className="settings-override-row">
          <span>{date}</span>
          <strong>{typeof value === 'string' ? value : value?.reason || 'بدون سبب'}</strong>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => onRemove(type, date)} aria-label="حذف">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  )
}
