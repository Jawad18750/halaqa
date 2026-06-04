import { useEffect, useMemo, useState } from 'react'
import { students, guardians } from '../api'
import { buildNaqzaLabels } from '../lib/labels.js'
import {
  emptyGuardianRow,
  loadSiblingGuardianTemplate,
  saveSiblingGuardianTemplate,
  needsInvite,
  telegramStatus,
} from '../lib/guardianUi.js'
import { confirmDialog } from './ui/ConfirmDialog.jsx'
import PageHeader from './ui/PageHeader.jsx'
import FormStepper from './ui/FormStepper.jsx'
import GuardianFormRows from './ui/GuardianFormRows.jsx'
import GuardianInvitePanel from './ui/GuardianInvitePanel.jsx'
import GuardianInviteModal from './ui/GuardianInviteModal.jsx'
import AvatarCropper from './AvatarCropper.jsx'
import Toast from './ui/Toast.jsx'
import MemorizationFields from './ui/MemorizationFields.jsx'
import { formatMemorizationFromThumun } from '../lib/labels.js'

const ADD_STUDENT_STEPS = [
  { id: 1, label: 'بيانات' },
  { id: 2, label: 'أولياء' },
  { id: 3, label: 'مراجعة' },
  { id: 4, label: 'دعوات' },
]

const placeholder = '/profile-placeholder.svg'

function toDateOnly(v) {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
    if (v.includes('T')) return v.split('T')[0]
  }
  try {
    const d = new Date(v)
    if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {}
  return ''
}

function PreviewCard({ number, name, naqza, photoPreview, naqzaLabels }) {
  const naqzaLabel = naqzaLabels[Number(naqza) - 1]
  return (
    <div className="add-student-preview student-item">
      <div className="student-item__tap add-student-preview__inner">
        <span className="student-item__number">{number || '—'}</span>
        <span className="student-item__avatar-wrap">
          <img className="student-item__avatar" src={photoPreview || placeholder} alt="" width={36} height={36} />
        </span>
        <div className="student-item__info">
          <p className="student-item__name">{name.trim() || 'اسم الطالب'}</p>
          <p className="student-item__meta">
            <span className="student-item__naqza">
              {naqza ? `${naqza}${naqzaLabel ? ` — ${naqzaLabel}` : ''}` : '—'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AddStudent({ thumuns, onBack, onOpenStudent, onNavigate, onDone }) {
  const [step, setStep] = useState(1)
  const [created, setCreated] = useState(null)
  const [savedGuardians, setSavedGuardians] = useState([])
  const [studentList, setStudentList] = useState([])
  const [existingGuardians, setExistingGuardians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [dobAdd, setDobAdd] = useState('')
  const [addNaqza, setAddNaqza] = useState(20)
  const [memorizationThumunId, setMemorizationThumunId] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [guardianRows, setGuardianRows] = useState([])
  const [inviteFallback, setInviteFallback] = useState(null)

  const naqzaLabels = buildNaqzaLabels(thumuns)

  const nextStudentNumber = useMemo(() => {
    if (!studentList.length) return 1
    return Math.max(...studentList.map(s => Number(s.number) || 0)) + 1
  }, [studentList])

  const duplicateNumber = useMemo(() => {
    const n = Number(number)
    if (!n) return false
    return studentList.some(s => Number(s.number) === n)
  }, [number, studentList])

  const step1Valid = number && name.trim() && !duplicateNumber
  const step2Valid = true

  async function loadBootstrap() {
    setLoading(true)
    setError('')
    try {
      const [studentsRes, guardiansRes] = await Promise.all([
        students.list(),
        guardians.list(),
      ])
      const list = studentsRes?.students || []
      setStudentList(list)
      setExistingGuardians(guardiansRes?.guardians || [])
      setNumber(String(Math.max(...list.map(s => Number(s.number) || 0), 0) + 1 || 1))
    } catch (e) {
      setError(e?.message || 'تعذر تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBootstrap() }, [])

  useEffect(() => {
    if (step !== 2) return
    guardians.list()
      .then(r => setExistingGuardians(r?.guardians || []))
      .catch(e => setError(e?.message || 'تعذر تحميل أولياء الأمور'))
  }, [step])

  function markDirty() { setDirty(true) }

  function resetWizard(keepGuardians = false) {
    setStep(1)
    setCreated(null)
    setSavedGuardians([])
    setNumber(String(nextStudentNumber))
    setName('')
    setDobAdd('')
    setAddNaqza(20)
    setPhotoFile(null)
    if (photoPreview) { try { URL.revokeObjectURL(photoPreview) } catch {} }
    setPhotoPreview('')
    setError('')
    if (!keepGuardians) setGuardianRows([])
    setDirty(false)
  }

  async function handleBack() {
    if (dirty && step < 4) {
      const ok = await confirmDialog('مغادرة', 'لم يُحفظ الطالب. هل تريد المغادرة؟')
      if (!ok) return
    }
    onBack?.()
  }

  function finishWizard() {
    onBack?.()
  }

  function addGuardianRow() {
    markDirty()
    setGuardianRows(rows => [...rows, emptyGuardianRow({ isPrimary: rows.length === 0 })])
  }

  function updateGuardianRow(rowId, patch) {
    markDirty()
    setGuardianRows(rows => rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  function removeGuardianRow(rowId) {
    markDirty()
    setGuardianRows(rows => rows.filter(r => r.id !== rowId))
  }

  function applySiblingTemplate() {
    const template = loadSiblingGuardianTemplate()
    if (!template?.length) {
      setToast('لا يوجد قالب محفوظ')
      return
    }
    setGuardianRows(template)
    markDirty()
    setToast('تم نسخ أولياء آخر طالب')
  }

  function handlePhotoPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024 || !/^(image\/jpeg|image\/png)$/i.test(f.type)) {
      setError('الصورة يجب أن تكون JPG أو PNG وأقل من 2MB')
      return
    }
    setPendingFile(f)
    setShowCropper(true)
    markDirty()
  }

  function onCropped(file) {
    setPhotoFile(file)
    if (photoPreview) { try { URL.revokeObjectURL(photoPreview) } catch {} }
    setPhotoPreview(URL.createObjectURL(file))
    setShowCropper(false)
    setPendingFile(null)
  }

  async function saveStudent() {
    setError('')
    setSaving(true)
    try {
      const { student: newStudent } = await students.create({ number: Number(number), name: name.trim() })
      const updates = {}
      if (dobAdd) {
        const dateOnly = toDateOnly(dobAdd)
        if (dateOnly) updates.date_of_birth = dateOnly
      }
      if (Number(addNaqza) !== 20) updates.current_naqza = Number(addNaqza)
      if (memorizationThumunId != null) updates.memorization_thumun_id = Number(memorizationThumunId)
      if (Object.keys(updates).length) {
        await students.update(newStudent.id, updates)
        Object.assign(newStudent, updates)
      }
      if (photoFile) {
        await students.uploadPhoto(newStudent.id, photoFile)
      }

      let primarySet = false
      const linkedGuardians = []
      for (const row of guardianRows) {
        if (row.mode === 'existing') {
          if (!row.guardianId) continue
          const { guardian } = await guardians.linkToStudent(newStudent.id, {
            guardianId: row.guardianId,
            relationship: row.relationship.trim() || null,
            is_primary: row.isPrimary && !primarySet,
            notify_on_result: row.notifyOnResult,
          })
          linkedGuardians.push(guardian || existingGuardians.find(g => g.id === row.guardianId))
          if (row.isPrimary) primarySet = true
          continue
        }
        if (!row.name.trim() || !row.phone.trim()) continue
        const { guardian } = await guardians.linkToStudent(newStudent.id, {
          name: row.name.trim(),
          phone: row.phone.trim(),
          relationship: row.relationship.trim() || null,
          is_primary: row.isPrimary && !primarySet,
          notify_on_result: row.notifyOnResult,
        })
        linkedGuardians.push(guardian)
        if (row.isPrimary) primarySet = true
      }

      saveSiblingGuardianTemplate(guardianRows)
      newStudent.current_naqza = Number(addNaqza)
      setCreated(newStudent)
      setSavedGuardians(linkedGuardians.filter(Boolean))
      setStep(4)
      setDirty(false)
      onDone?.()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    setError('')
    if (step >= 4) return
    setStep(s => Math.min(4, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPrev() {
    if (step >= 4) return
    setStep(s => Math.max(1, s - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reviewGuardians = guardianRows.filter(row => {
    if (row.mode === 'existing') return !!row.guardianId
    return row.name.trim() && row.phone.trim()
  })

  if (loading) {
    return (
      <div className="add-student-view">
        <PageHeader title="إضافة طالب" onBack={handleBack} />
        <div className="loading">جاري التحميل…</div>
      </div>
    )
  }

  return (
    <div className="add-student-view">
      <PageHeader title="إضافة طالب" onBack={handleBack} />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
      {error && <div className="alert alert--error">{error}</div>}

      <>
        <FormStepper
          step={step}
          totalSteps={4}
          steps={ADD_STUDENT_STEPS}
          canNext={step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step1Valid : true}
          canPrev={step < 4}
          isLast={step === 3 || step === 4}
          saving={saving}
          showSkip={step === 2}
          nextLabel="التالي"
          submitLabel={step === 4 ? 'إنهاء' : 'حفظ الطالب'}
          onNext={goNext}
          onPrev={goPrev}
          onSkip={goNext}
          onSubmit={step === 4 ? finishWizard : saveStudent}
        />

        <div className="add-student-body">
          {step === 1 && (
              <section className="add-student-step add-student-step--student-info">
                <PreviewCard
                  number={number}
                  name={name}
                  naqza={addNaqza}
                  photoPreview={photoPreview}
                  naqzaLabels={naqzaLabels}
                />

                <label className="field">
                  <span className="field__label">الرقم</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={number}
                    onChange={e => { setNumber(e.target.value); markDirty() }}
                    required
                    autoFocus
                  />
                  {duplicateNumber && <span className="field__hint field__hint--warn">الرقم مستخدم مسبقاً</span>}
                </label>
                <label className="field">
                  <span className="field__label">الاسم</span>
                  <input className="input" value={name} onChange={e => { setName(e.target.value); markDirty() }} required />
                </label>
                <label className="field">
                  <span className="field__label">تاريخ الميلاد</span>
                  <input className="input" type="date" value={dobAdd} onChange={e => { setDobAdd(e.target.value); markDirty() }} />
                </label>
                <label className="field">
                  <span className="field__label">النقزة الحالية (للاختبار)</span>
                  <select className="input" value={addNaqza} onChange={e => { setAddNaqza(Number(e.target.value)); markDirty() }}>
                    {naqzaLabels.map((label, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} — {label}</option>
                    ))}
                  </select>
                </label>

                <MemorizationFields
                  thumuns={thumuns}
                  value={memorizationThumunId}
                  onChange={v => { setMemorizationThumunId(v); markDirty() }}
                  idPrefix="add-student-mem"
                />

                <div className="add-student-photo">
                  <button type="button" className="add-student-photo__tap" onClick={() => document.getElementById('add-student-photo-input')?.click()}>
                    <img src={photoPreview || placeholder} alt="" className="add-student-photo__img" />
                    <span className="add-student-photo__label"><i className="fa-solid fa-camera" /> اختيار صورة</span>
                  </button>
                  <input id="add-student-photo-input" type="file" accept="image/jpeg,image/png" hidden onChange={handlePhotoPick} />
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="add-student-step">
                <div className="add-student-telegram-info">
                  <i className="fa-brands fa-telegram" aria-hidden />
                  <div>
                    <strong>إشعارات Telegram لأولياء الأمور</strong>
                    <p className="meta">
                      أرسل الدعوة لولي الأمر — يضغط الرابط أو يرسل الرقم (6 أرقام) للبوت مرة واحدة، ثم تصل النتائج تلقائياً 📬
                    </p>
                  </div>
                </div>

                {loadSiblingGuardianTemplate()?.length > 0 && (
                  <button type="button" className="btn btn--ghost btn--sm add-student-sibling-chip" onClick={applySiblingTemplate}>
                    <i className="fa-solid fa-clone" /> نسخ أولياء من آخر طالب
                  </button>
                )}

                <GuardianFormRows
                  rows={guardianRows}
                  existingGuardians={existingGuardians}
                  onAdd={addGuardianRow}
                  onUpdate={updateGuardianRow}
                  onRemove={removeGuardianRow}
                  onSkip={goNext}
                />
              </section>
            )}

            {step === 3 && (
              <section className="add-student-step">
                <h3 className="add-student-step__heading">مراجعة</h3>
                <PreviewCard
                  number={number}
                  name={name}
                  naqza={addNaqza}
                  photoPreview={photoPreview}
                  naqzaLabels={naqzaLabels}
                />
                {dobAdd && <p className="meta">تاريخ الميلاد: {dobAdd}</p>}
                {memorizationThumunId != null && (
                  <p className="meta">مستوى الحفظ: {formatMemorizationFromThumun(memorizationThumunId, thumuns)}</p>
                )}
                <h4 className="add-student-step__sub">أولياء الأمور ({reviewGuardians.length})</h4>
                {reviewGuardians.length === 0 ? (
                  <div className="add-student-review-empty">
                    <p className="meta">لا يوجد أولياء — يمكن إضافتهم لاحقاً من الملف.</p>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(2)}>
                      <i className="fa-solid fa-user-group" /> إضافة ولي الآن
                    </button>
                  </div>
                ) : (
                  <ul className="add-student-review-guardians">
                    {reviewGuardians.map(row => {
                      const existing = row.mode === 'existing'
                        ? existingGuardians.find(g => g.id === row.guardianId)
                        : null
                      const label = existing?.name || row.name
                      const phone = existing?.phone_e164 || row.phone
                      const tg = existing ? telegramStatus(existing) : { label: 'جديد', className: 'guardian-badge--muted' }
                      return (
                        <li key={row.id} className="add-student-review-guardian">
                          <div className="add-student-review-guardian__main">
                            <strong>{label}</strong>
                            {phone && <span className="meta" dir="ltr">{phone}</span>}
                            {row.relationship && <span className="meta">· {row.relationship}</span>}
                            {row.isPrimary && <span className="guardian-primary"><i className="fa-solid fa-star" /></span>}
                          </div>
                          <span className={`guardian-badge ${tg.className}`}>{tg.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {reviewGuardians.some(r => {
                  const g = r.mode === 'existing' ? existingGuardians.find(x => x.id === r.guardianId) : null
                  return !g || needsInvite(g)
                }) && (
                  <p className="add-student-review-note meta">
                    <i className="fa-brands fa-telegram" /> الخطوة التالية: إرسال دعوات Telegram لأولياء الأمور.
                  </p>
                )}
              </section>
            )}

            {step === 4 && created && (
              <section className="add-student-step add-student-step--invites">
                <div className="add-student-success__icon" aria-hidden>
                  <i className="fa-solid fa-circle-check" />
                </div>
                <h2 className="add-student-success__title">تمت إضافة {created.name}</h2>

                <GuardianInvitePanel
                  guardians={savedGuardians}
                  studentName={created.name}
                  title="إرسال دعوات Telegram"
                  hint="اختر واتساب أو Telegram أو SMS لكل ولي — ثم اضغط إرسال في التطبيق."
                  emptyMessage="لم تُضف أولياء — يمكن ربطهم لاحقاً من ملف الطالب."
                  onToast={setToast}
                  onInviteFallback={setInviteFallback}
                />

                <div className="add-student-success__actions">
                  <button type="button" className="btn btn--primary" onClick={() => onOpenStudent?.(created, 'students')}>
                    فتح الملف
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => onOpenStudent?.(created, 'test')}>
                    بدء اختبار
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => resetWizard(true)}>
                    إضافة طالب آخر
                  </button>
                </div>
              </section>
            )}
          </div>
        </>

      {showCropper && pendingFile && (
        <AvatarCropper
          file={pendingFile}
          onCancel={() => { setShowCropper(false); setPendingFile(null) }}
          onCropped={onCropped}
        />
      )}

      <GuardianInviteModal
        open={!!inviteFallback}
        title={`إرسال دعوة — ${inviteFallback?.guardian?.name || ''}`}
        message={inviteFallback?.message}
        inviteParams={inviteFallback?.inviteParams}
        guardian={inviteFallback?.guardian}
        deepLink={inviteFallback?.deepLink}
        onClose={() => setInviteFallback(null)}
        onCopy={async (text) => {
          try {
            await navigator.clipboard.writeText(text)
            setToast('تم نسخ الرسالة')
          } catch {
            setToast('تعذر النسخ')
          }
        }}
      />
    </div>
  )
}
