import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardians } from '../api'
import GuardianCard from './ui/GuardianCard.jsx'
import GuardianFormRows from './ui/GuardianFormRows.jsx'
import GuardianInvitePanel from './ui/GuardianInvitePanel.jsx'
import GuardianInviteModal from './ui/GuardianInviteModal.jsx'
import GuardianMessageSheet from './ui/GuardianMessageSheet.jsx'
import { emptyGuardianRow, isTelegramActive } from '../lib/guardianUi.js'

export default function GuardianSection({ student, onToast }) {
  const [rows, setRows] = useState([])
  const [existingGuardians, setExistingGuardians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [linkedGuardians, setLinkedGuardians] = useState([])
  const [guardianRows, setGuardianRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [messageTargets, setMessageTargets] = useState([])
  const [showMessageSheet, setShowMessageSheet] = useState(false)
  const [inviteFallback, setInviteFallback] = useState(null)

  const linkedGuardianIds = useMemo(() => new Set(rows.map(r => r.id)), [rows])

  const availableExistingGuardians = useMemo(
    () => existingGuardians.filter(g => !linkedGuardianIds.has(g.id)),
    [existingGuardians, linkedGuardianIds]
  )

  const loadStudentGuardians = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { guardians: list } = await guardians.forStudent(student.id)
      setRows(list)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [student.id])

  async function loadExistingGuardians() {
    try {
      const { guardians: list } = await guardians.list()
      setExistingGuardians(list || [])
    } catch {
      setExistingGuardians([])
    }
  }

  useEffect(() => { loadStudentGuardians() }, [loadStudentGuardians])

  useEffect(() => {
    if (showForm) loadExistingGuardians()
  }, [showForm, student?.id])

  function openAddForm() {
    setGuardianRows([
      emptyGuardianRow({
        isPrimary: rows.length === 0,
        notifyOnResult: rows.length === 0,
      }),
    ])
    setLinkedGuardians([])
    setFormMode('add')
    setShowForm(true)
    setError('')
  }

  function closeAddForm() {
    setShowForm(false)
    setFormMode('add')
    setLinkedGuardians([])
    setGuardianRows([])
    setError('')
  }

  async function finishInviteStep() {
    closeAddForm()
    onToast?.('تمت الإضافة')
    await loadStudentGuardians()
  }

  function addGuardianRow() {
    setGuardianRows(prev => [...prev, emptyGuardianRow({ isPrimary: false, notifyOnResult: false })])
  }

  function updateGuardianRow(rowId, patch) {
    setGuardianRows(prev => prev.map(r => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  function removeGuardianRow(rowId) {
    setGuardianRows(prev => prev.filter(r => r.id !== rowId))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!guardianRows.length) return

    setSaving(true)
    setError('')

    try {
      let primarySet = rows.some(r => r.is_primary)
      const linked = []
      let reusedAny = false

      for (const row of guardianRows) {
        if (row.mode === 'existing') {
          if (!row.guardianId) {
            throw new Error('اختر ولي أمراً من القائمة أو أضف ولياً جديداً')
          }
          const { guardian, reused } = await guardians.linkToStudent(student.id, {
            guardianId: row.guardianId,
            relationship: row.relationship.trim() || null,
            is_primary: row.isPrimary && !primarySet,
            notify_on_result: row.notifyOnResult,
            notify_weekly_attendance: row.notifyWeeklyAttendance,
          })
          linked.push(guardian || availableExistingGuardians.find(g => g.id === row.guardianId))
          if (reused) reusedAny = true
          if (row.isPrimary) primarySet = true
          continue
        }

        if (!row.name.trim() || !row.phone.trim()) {
          throw new Error('أدخل اسم ولي الأمر ورقم الهاتف، أو اختر ولياً موجوداً')
        }

        const { guardian, reused } = await guardians.linkToStudent(student.id, {
          name: row.name.trim(),
          phone: row.phone.trim(),
          relationship: row.relationship.trim() || null,
          is_primary: row.isPrimary && !primarySet,
          notify_on_result: row.notifyOnResult,
          notify_weekly_attendance: row.notifyWeeklyAttendance,
        })
        linked.push(guardian)
        if (reused) reusedAny = true
        if (row.isPrimary) primarySet = true
      }

      setLinkedGuardians(linked.filter(Boolean))
      setFormMode('invite')
      onToast?.(reusedAny ? 'تم ربط ولي موجود مسبقاً — أرسل الدعوة الآن' : 'تم الحفظ — أرسل الدعوة الآن')
    } catch (err) {
      if (err.status === 409 && err.existingGuardian) {
        setError(`${err.message} (${err.existingGuardian.name} — ${err.existingGuardian.phone_e164})`)
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function togglePrimary(row) {
    if (row.is_primary) return
    try {
      await guardians.updateLink(row.link_id, { is_primary: true })
      onToast?.('تم تعيين ولي أساسي')
      await loadStudentGuardians()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleNotify(row) {
    try {
      await guardians.updateLink(row.link_id, { notify_on_result: !row.notify_on_result })
      await loadStudentGuardians()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleWeeklyAttendance(row) {
    try {
      await guardians.updateLink(row.link_id, { notify_weekly_attendance: !row.notify_weekly_attendance })
      await loadStudentGuardians()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="guardian-section">
      <p className="meta guardian-section__hint">
        اختر واتساب أو Telegram أو SMS — ولي الأمر يضغط الرابط أو يرسل الرقم (6 أرقام) للبوت.
        يمكنك اختيار ولي مسجّل مسبقاً أو إضافة ولي جديد.
      </p>

      {error && <div className="alert alert--error" style={{ marginBottom: 8 }}>{error}</div>}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : (
        <>
          {rows.length === 0 && !showForm && (
            <p className="meta">لا يوجد أولياء أمور مرتبطون بهذا الطالب.</p>
          )}

          <ul className="guardian-list guardian-list--cards">
            {rows.map(row => (
              <GuardianCard
                key={row.link_id}
                row={row}
                variant="profile"
                student={student}
                onTogglePrimary={togglePrimary}
                onToggleNotify={toggleNotify}
                onToggleWeeklyAttendance={toggleWeeklyAttendance}
                onRefresh={loadStudentGuardians}
                onToast={onToast}
                onSendMessage={isTelegramActive(row) ? g => { setMessageTargets([g]); setShowMessageSheet(true) } : undefined}
              />
            ))}
          </ul>

          {showForm ? (
            formMode === 'invite' && linkedGuardians.length > 0 ? (
              <div className="guardian-form guardian-form--invite stack">
                <p className="guardian-form__invite-heading">
                  <i className="fa-solid fa-circle-check" aria-hidden />
                  {' '}تم ربط {linkedGuardians.length === 1 ? linkedGuardians[0].name : `${linkedGuardians.length} أولياء`}
                </p>
                <GuardianInvitePanel
                  guardians={linkedGuardians}
                  studentName={student.name}
                  compact
                  onToast={onToast}
                  onInviteFallback={setInviteFallback}
                />
                <div className="cluster">
                  <button type="button" className="btn btn--primary btn--sm" onClick={finishInviteStep}>
                    تم
                  </button>
                </div>
              </div>
            ) : (
              <form className="guardian-form stack" onSubmit={handleAdd}>
                <GuardianFormRows
                  rows={guardianRows}
                  existingGuardians={availableExistingGuardians}
                  onAdd={addGuardianRow}
                  onUpdate={updateGuardianRow}
                  onRemove={removeGuardianRow}
                />
                {guardianRows.length > 0 && (
                  <div className="cluster">
                    <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                      {saving ? 'جاري الحفظ…' : 'حفظ ومتابعة'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={closeAddForm}>إلغاء</button>
                  </div>
                )}
              </form>
            )
          ) : (
            <button type="button" className="btn btn--ghost guardian-section__add" onClick={openAddForm}>
              <i className="fa-solid fa-plus" /> إضافة ولي أمر
            </button>
          )}
        </>
      )}

      <GuardianMessageSheet
        open={showMessageSheet}
        guardians={messageTargets}
        onClose={() => setShowMessageSheet(false)}
        onToast={onToast}
      />

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
            onToast?.('تم نسخ الرسالة')
          } catch {
            onToast?.('تعذر النسخ')
          }
        }}
      />
    </div>
  )
}
