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
import { appendSignatureFooter, hasHalaqaSettings } from '../lib/messageContext.js'
import { useMessageSettings } from '../lib/MessageSettingsContext.jsx'

const TARGETS = [
  { id: 'all', label: 'الكل', icon: 'fa-solid fa-users' },
  { id: 'student', label: 'طالب', icon: 'fa-solid fa-user-graduate' },
  { id: 'family', label: 'عائلة', icon: 'fa-solid fa-people-roof' },
  { id: 'guardians', label: 'أولياء محددون', icon: 'fa-solid fa-user-group' },
]

export default function Broadcast({ onBack, onOpenMessageLog }) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [message, setMessage] = useState('')
  const [appendSignature, setAppendSignature] = useState(true)
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
  const canAppendSignature = hasHalaqaSettings({ sheikhName, masjidName })

  const selectedFamily = useMemo(
    () => families.find(f => f.id === targetId) || null,
    [families, targetId]
  )

  const selectedFamilyStudents = useMemo(
    () => parseFamilyStudents(selectedFamily),
    [selectedFamily]
  )

  const estimatedRecipients = useMemo(() => {
    if (targetType === 'guardians') {
      return linkedGuardians.filter(g => targetIds.has(g.id)).length
    }
    if (targetType === 'student' && targetId) {
      return linkedGuardians.filter(g =>
        (g.students || []).some(s => s.id === targetId)
      ).length
    }
    if (targetType === 'family' && selectedFamily) {
      const ids = new Set(selectedFamilyStudents.map(s => s.id))
      return linkedGuardians.filter(g =>
        (g.students || []).some(s => ids.has(s.id))
      ).length
    }
    return linkedGuardians.length
  }, [targetType, targetIds, targetId, linkedGuardians, selectedFamily, selectedFamilyStudents])

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
    if (estimatedRecipients === 0) {
      setError('لا يوجد أولياء أمور مربوطون ضمن هذا الاختيار')
      return
    }

    const ok = await confirmDialog(
      'إرسال رسالة إلى أولياء الأمور',
      `سيتم إرسال هذه الرسالة إلى ${estimatedRecipients} من أولياء الأمور المرتبطين عبر Telegram. هل تريد المتابعة؟`
    )
    if (!ok) return

    setSending(true)
    setError('')
    setResult(null)
    try {
      const ids = targetType === 'guardians' ? [...targetIds] : null
      const body = message.trim()
      const outgoing = canAppendSignature && appendSignature
        ? appendSignatureFooter(body, { sheikhName, masjidName })
        : body
      const res = await notifications.broadcast(
        outgoing,
        targetType,
        targetType === 'all' || targetType === 'guardians' ? null : targetId,
        ids
      )
      setResult(res)
      const sent = res.stats?.sent ?? 0
      const failed = res.stats?.failed ?? 0
      if (sent === 0 && failed > 0) {
        setToast('تعذر إرسال الرسالة — تحقق من الربط')
      } else if (failed > 0) {
        setToast(`تم الإرسال إلى ${sent} — فشل ${failed}`)
      } else {
        setToast(`تم الإرسال إلى ${sent} من أولياء الأمور`)
      }
      if (targetType === 'guardians') setTargetIds(new Set())
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
              placeholder="اكتب رسالة عامة لأولياء الأمور…"
              required
            />
            <span className="field__hint">{message.length}/1000</span>
          </label>

          {canAppendSignature && (
            <label className="message-signature-toggle">
              <input
                type="checkbox"
                checked={appendSignature}
                onChange={e => setAppendSignature(e.target.checked)}
              />
              <span>إضافة توقيع الحلقة في نهاية الرسالة</span>
            </label>
          )}

          <p className="meta broadcast-form__recipients">
            المستلمون المتوقعون: {estimatedRecipients} من أولياء الأمور المرتبطين عبر Telegram
          </p>

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
                  <p className="field__hint">يُرسل لأولياء هؤلاء الطلاب المرتبطين على Telegram.</p>
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
                  {guardianList.filter(g => !isTelegramActive(g)).length} ولي أمر غير مربوط — لن يُرسل إليهم.
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
            {sending ? 'جاري الإرسال…' : 'إرسال الرسالة'}
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

      <section className="broadcast-panel broadcast-panel--log-cta">
        <h2 className="broadcast-panel__title">سجل الرسائل</h2>
        <p className="meta">
          اطلع على كل ما أُرسل لأولياء الأمور — نتائج الاختبارات، الحضور الأسبوعي، والرسائل اليدوية.
        </p>
        {result?.broadcastId && onOpenMessageLog && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginBottom: 8 }}
            onClick={() => onOpenMessageLog({ broadcastId: result.broadcastId, type: 'broadcast' })}
          >
            <i className="fa-brands fa-telegram" /> عرض رسالة هذا الإرسال
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onOpenMessageLog?.()}
        >
          <i className="fa-solid fa-envelope-open-text" /> عرض سجل الرسائل الكامل
        </button>
      </section>
    </div>
  )
}
