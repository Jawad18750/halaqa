import { useEffect, useMemo, useState } from 'react'
import { students, guardians, notifications } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import StatTile from './ui/StatTile.jsx'
import Toast from './ui/Toast.jsx'
import EmptyState from './ui/EmptyState.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'
import {
  isTelegramActive,
  guardianDisplayName,
  parseFamilyStudents,
  formatFamilyLabel,
} from '../lib/guardianUi.js'

const STATUS_LABELS = {
  sent: 'تم الإرسال',
  failed: 'فشل',
  no_telegram_link: 'غير مربوط',
  opt_out: 'غير مشترك',
  skipped_no_recipient: 'لا مستلم',
}

const TARGETS = [
  { id: 'all', label: 'الكل', icon: 'fa-solid fa-users' },
  { id: 'student', label: 'طالب', icon: 'fa-solid fa-user-graduate' },
  { id: 'family', label: 'عائلة', icon: 'fa-solid fa-people-roof' },
  { id: 'guardians', label: 'أولياء محددون', icon: 'fa-solid fa-user-group' },
]

export default function Broadcast({ onBack }) {
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState('all')
  const [targetId, setTargetId] = useState('')
  const [targetIds, setTargetIds] = useState(new Set())
  const [guardianQuery, setGuardianQuery] = useState('')
  const [studentList, setStudentList] = useState([])
  const [guardianList, setGuardianList] = useState([])
  const [families, setFamilies] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [logEntries, setLogEntries] = useState([])
  const [logLoading, setLogLoading] = useState(true)
  const [familyName, setFamilyName] = useState('')
  const [familyStudentIds, setFamilyStudentIds] = useState([])
  const [showFamilyCreate, setShowFamilyCreate] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)

  async function loadFamilies() {
    const { families: f } = await notifications.listFamilies().catch(() => ({ families: [] }))
    setFamilies(f || [])
    return f || []
  }

  useEffect(() => {
    students.list().then(({ students: rows }) => setStudentList(rows || [])).catch(() => {})
    guardians.list().then(({ guardians: rows }) => setGuardianList(rows || [])).catch(() => {})
    loadFamilies()
  }, [])

  const linkedGuardians = useMemo(() => guardianList.filter(isTelegramActive), [guardianList])

  const filteredGuardians = useMemo(() => {
    const q = guardianQuery.trim()
    let base = linkedGuardians
    if (q) {
      base = base.filter(g =>
        (g.name || '').includes(q) || (g.phone_e164 || '').includes(q)
      )
    }
    return base
  }, [linkedGuardians, guardianQuery])

  const selectedFamily = useMemo(
    () => families.find(f => f.id === targetId) || null,
    [families, targetId]
  )

  const selectedFamilyStudents = useMemo(
    () => parseFamilyStudents(selectedFamily),
    [selectedFamily]
  )

  async function loadLog() {
    setLogLoading(true)
    try {
      const { entries } = await notifications.log(30)
      setLogEntries(entries || [])
    } catch {
      setLogEntries([])
    } finally {
      setLogLoading(false)
    }
  }

  useEffect(() => { loadLog() }, [])

  function toggleGuardianId(id) {
    setTargetIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllGuardians() {
    setTargetIds(new Set(filteredGuardians.map(g => g.id)))
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!message.trim()) return

    if (targetType === 'guardians' && targetIds.size === 0) {
      setError('اختر ولياً واحداً على الأقل')
      return
    }
    if (targetType === 'family' && !targetId) {
      setError('اختر عائلة أو أنشئ واحدة')
      return
    }
    if (targetType === 'student' && !targetId) {
      setError('اختر طالباً')
      return
    }

    const countLabel = targetType === 'guardians'
      ? `${targetIds.size} ولي`
      : targetType === 'family' && selectedFamily
        ? `عائلة ${selectedFamily.name}`
        : 'المستهدفين'

    const ok = await confirmDialog('إرسال رسالة', `إرسال هذه الرسالة إلى ${countLabel} عبر Telegram؟`)
    if (!ok) return

    setSending(true)
    setError('')
    setResult(null)
    try {
      const ids = targetType === 'guardians' ? [...targetIds] : null
      const res = await notifications.broadcast(
        message.trim(),
        targetType,
        targetType === 'all' || targetType === 'guardians' ? null : targetId,
        ids
      )
      setResult(res)
      setToast('تم إرسال الرسالة')
      setMessage('')
      if (targetType === 'guardians') setTargetIds(new Set())
      await loadLog()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function handleCreateFamily(e) {
    e.preventDefault()
    if (!familyName.trim() || !familyStudentIds.length) return
    setSavingFamily(true)
    setError('')
    try {
      const trimmedName = familyName.trim()
      const { family } = await notifications.createFamily(trimmedName, familyStudentIds)
      setToast('تم إنشاء العائلة')
      setFamilyName('')
      setFamilyStudentIds([])
      setShowFamilyCreate(false)
      const rows = await loadFamilies()
      const createdId = family?.id || rows.find(f => f.name === trimmedName)?.id
      if (createdId) {
        setTargetType('family')
        setTargetId(createdId)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingFamily(false)
    }
  }

  async function handleDeleteFamily(family) {
    const ok = await confirmDialog('حذف العائلة', `حذف «${family.name}»؟`)
    if (!ok) return
    try {
      await notifications.removeFamily(family.id)
      if (targetId === family.id) setTargetId('')
      await loadFamilies()
      setToast('تم حذف العائلة')
    } catch (e) {
      setError(e.message)
    }
  }

  function toggleFamilyStudent(id) {
    setFamilyStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="stack broadcast-page">
      <PageHeader title="رسائل Telegram" subtitle="إرسال إعلانات أو رسائل مخصصة" onBack={onBack} />
      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <section className="broadcast-panel">
        <h2 className="broadcast-panel__title">
          <i className="fa-brands fa-telegram" aria-hidden />
          رسالة جديدة
        </h2>

        <form className="broadcast-form stack" onSubmit={handleSend}>
          <label className="field">
            <span className="field__label">الرسالة</span>
            <textarea
              className="input broadcast-form__textarea"
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 1000))}
              placeholder="اكتب رسالتك بالعربية…"
              required
            />
            <span className="field__hint">{message.length}/1000</span>
          </label>

          <div className="field">
            <span className="field__label">المستهدفون</span>
            <div className="broadcast-targets" role="tablist" aria-label="نوع المستهدف">
              {TARGETS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={targetType === t.id}
                  className={`broadcast-targets__chip ${targetType === t.id ? 'broadcast-targets__chip--active' : ''}`}
                  onClick={() => {
                    setTargetType(t.id)
                    setTargetId('')
                    setError('')
                    if (t.id === 'family' && families.length === 0) setShowFamilyCreate(true)
                  }}
                >
                  <i className={t.icon} aria-hidden />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {targetType === 'student' && (
            <label className="field">
              <span className="field__label">الطالب</span>
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)} required>
                <option value="">— اختر طالباً —</option>
                {studentList.map(s => (
                  <option key={s.id} value={s.id}>{s.number} — {s.name}</option>
                ))}
              </select>
            </label>
          )}

          {targetType === 'family' && (
            <div className="broadcast-family-target">
              {families.length > 0 && (
                <label className="field">
                  <span className="field__label">اسم العائلة</span>
                  <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">— اختر عائلة —</option>
                    {families.map(f => (
                      <option key={f.id} value={f.id}>{formatFamilyLabel(f)}</option>
                    ))}
                  </select>
                </label>
              )}

              {selectedFamily && (
                <div className="broadcast-family-preview">
                  <div className="broadcast-family-preview__head">
                    <strong>{selectedFamily.name}</strong>
                    <span className="meta">{selectedFamilyStudents.length} طالب</span>
                  </div>
                  <ul className="broadcast-family-preview__list">
                    {selectedFamilyStudents.map(s => (
                      <li key={s.id}>
                        <span className="broadcast-family-preview__num">{s.number}</span>
                        {s.name}
                      </li>
                    ))}
                  </ul>
                  <p className="field__hint">يُرسل لأولياء هؤلاء الطلاب المربوطين على Telegram.</p>
                </div>
              )}

              {families.length === 0 && !showFamilyCreate && (
                <EmptyState
                  title="لا توجد عائلات"
                  subtitle="أنشئ عائلة باسم (مثل: عائلة البوسيفي) واختر الإخوة"
                  action={(
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowFamilyCreate(true)}>
                      <i className="fa-solid fa-plus" /> إنشاء عائلة
                    </button>
                  )}
                />
              )}

              {(showFamilyCreate || families.length === 0) && (
                <div className="broadcast-family-create">
                  <h3 className="broadcast-family-create__title">
                    {families.length ? 'إنشاء عائلة جديدة' : 'إنشاء أول عائلة'}
                  </h3>
                  <p className="meta broadcast-family-create__hint">
                    اختر اسماً واضحاً — مثل «عائلة الفيتوري» — ثم حدّد الإخوة.
                  </p>
                  <label className="field">
                    <span className="field__label">اسم العائلة</span>
                    <input
                      className="input"
                      value={familyName}
                      onChange={e => setFamilyName(e.target.value)}
                      placeholder="مثال: عائلة البوسيفي"
                    />
                  </label>
                  <div className="field">
                    <span className="field__label">طلاب العائلة</span>
                    <div className="broadcast-family-pick">
                      {studentList.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className={`broadcast-family-pick__chip ${familyStudentIds.includes(s.id) ? 'broadcast-family-pick__chip--active' : ''}`}
                          onClick={() => toggleFamilyStudent(s.id)}
                        >
                          {s.number} — {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="broadcast-family-create__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={savingFamily || !familyName.trim() || !familyStudentIds.length}
                      onClick={handleCreateFamily}
                    >
                      {savingFamily ? 'جاري الحفظ…' : 'حفظ العائلة'}
                    </button>
                    {families.length > 0 && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowFamilyCreate(false)}>
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              )}

              {families.length > 0 && !showFamilyCreate && (
                <button type="button" className="btn btn--ghost btn--sm broadcast-family-target__add" onClick={() => setShowFamilyCreate(true)}>
                  <i className="fa-solid fa-plus" /> عائلة جديدة
                </button>
              )}
            </div>
          )}

          {targetType === 'guardians' && (
            <div className="broadcast-guardian-pick">
              <div className="broadcast-guardian-pick__head">
                <span className="field__label">اختر أولياء مربوطين</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={selectAllGuardians}>
                  تحديد الكل ({filteredGuardians.length})
                </button>
              </div>
              <div className="students-search broadcast-guardian-pick__search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden />
                <input
                  className="students-search__input"
                  placeholder="بحث بالاسم أو الهاتف"
                  value={guardianQuery}
                  onChange={e => setGuardianQuery(e.target.value)}
                  aria-label="بحث أولياء"
                />
              </div>
              {linkedGuardians.length === 0 ? (
                <p className="meta broadcast-guardian-pick__empty">لا يوجد أولياء مربوطون — اربط Telegram من صفحة أولياء الأمور.</p>
              ) : (
                <div className="broadcast-guardian-pick__list">
                  {filteredGuardians.map(g => (
                    <label key={g.id} className="broadcast-guardian-pick__item">
                      <input
                        type="checkbox"
                        checked={targetIds.has(g.id)}
                        onChange={() => toggleGuardianId(g.id)}
                      />
                      <span className="broadcast-guardian-pick__body">
                        <span className="broadcast-guardian-pick__name">{guardianDisplayName(g)}</span>
                        <span className="broadcast-guardian-pick__phone" dir="ltr">{g.phone_e164}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {guardianList.some(g => !isTelegramActive(g)) && (
                <p className="field__hint">
                  {guardianList.filter(g => !isTelegramActive(g)).length} ولي غير مربوط — لن يُرسل إليهم.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary broadcast-form__submit"
            disabled={
              sending ||
              !message.trim() ||
              (targetType === 'guardians' && targetIds.size === 0) ||
              (targetType === 'family' && !targetId && !showFamilyCreate)
            }
          >
            {sending ? 'جاري الإرسال…' : 'إرسال عبر Telegram'}
          </button>
        </form>

        {result?.stats && (
          <div className="broadcast-stats">
            <StatTile label="تم الإرسال" value={result.stats.sent ?? 0} tone="ok" />
            <StatTile label="فشل" value={result.stats.failed ?? 0} tone="warn" />
            <StatTile label="غير مربوط" value={result.stats.noLink ?? 0} />
            <StatTile label="غير مشترك" value={result.stats.optOut ?? 0} />
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}
      </section>

      {families.length > 0 && (
        <section className="broadcast-panel">
          <h2 className="broadcast-panel__title">
            <i className="fa-solid fa-people-roof" aria-hidden />
            العائلات المحفوظة
          </h2>
          <ul className="broadcast-family-list">
            {families.map(f => {
              const famStudents = parseFamilyStudents(f)
              return (
                <li key={f.id} className="broadcast-family-list__item">
                  <div className="broadcast-family-list__main">
                    <strong>{f.name}</strong>
                    <span className="meta">
                      {famStudents.length
                        ? famStudents.map(s => `${s.number} ${s.name}`).join(' · ')
                        : 'بدون طلاب'}
                    </span>
                  </div>
                  <div className="broadcast-family-list__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setTargetType('family'); setTargetId(f.id); setShowFamilyCreate(false) }}
                    >
                      اختيار
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      aria-label={`حذف ${f.name}`}
                      onClick={() => handleDeleteFamily(f)}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="broadcast-panel">
        <h2 className="broadcast-panel__title">سجل الإرسال</h2>
        {logLoading ? (
          <div className="loading">جاري التحميل…</div>
        ) : logEntries.length === 0 ? (
          <p className="meta">لا سجلات بعد.</p>
        ) : (
          <div className="broadcast-log">
            {logEntries.map(entry => (
              <article key={entry.id} className="broadcast-log__item">
                <div className="broadcast-log__meta">
                  <span className={`broadcast-log__status broadcast-log__status--${entry.status}`}>
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <time className="meta">
                    {entry.created_at ? new Date(entry.created_at).toLocaleString('ar-EG-u-nu-latn') : '—'}
                  </time>
                </div>
                <p className="broadcast-log__recipients">
                  {entry.guardian_name || '—'}
                  {entry.student_name ? ` · ${entry.student_name}` : ''}
                </p>
                <p className="broadcast-log__preview">{entry.message_preview || '—'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
