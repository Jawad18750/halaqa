import { useEffect, useState } from 'react'
import { guardians } from '../api'
import GuardianCard from './ui/GuardianCard.jsx'
import GuardianInvitePanel from './ui/GuardianInvitePanel.jsx'
import GuardianInviteModal from './ui/GuardianInviteModal.jsx'
import GuardianMessageSheet from './ui/GuardianMessageSheet.jsx'
import { isTelegramActive } from '../lib/guardianUi.js'

export default function GuardianSection({ student, onToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [newGuardian, setNewGuardian] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', relationship: '' })
  const [saving, setSaving] = useState(false)
  const [messageTargets, setMessageTargets] = useState([])
  const [showMessageSheet, setShowMessageSheet] = useState(false)
  const [inviteFallback, setInviteFallback] = useState(null)

  async function load() {
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
  }

  useEffect(() => { load() }, [student?.id])

  function openAddForm() {
    setForm({ name: '', phone: '', relationship: '' })
    setFormMode('add')
    setNewGuardian(null)
    setShowForm(true)
  }

  function closeAddForm() {
    setShowForm(false)
    setFormMode('add')
    setNewGuardian(null)
    setForm({ name: '', phone: '', relationship: '' })
  }

  async function finishInviteStep() {
    closeAddForm()
    onToast?.('تمت الإضافة')
    await load()
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    setError('')
    try {
      const { guardian, reused } = await guardians.linkToStudent(student.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        relationship: form.relationship.trim() || null,
      })
      setNewGuardian(guardian)
      setFormMode('invite')
      onToast?.(reused ? 'تم ربط ولي موجود مسبقاً — أرسل الدعوة الآن' : 'تم الحفظ — أرسل الدعوة الآن')
    } catch (e) {
      if (e.status === 409 && e.existingGuardian) {
        setError(`${e.message} (${e.existingGuardian.name} — ${e.existingGuardian.phone_e164})`)
      } else {
        setError(e.message)
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
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleNotify(row) {
    try {
      await guardians.updateLink(row.link_id, { notify_on_result: !row.notify_on_result })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="guardian-section">
      <p className="meta guardian-section__hint">
        اختر واتساب أو Telegram أو SMS — ولي الأمر يضغط الرابط أو يرسل الرقم (6 أرقام) للبوت.
        أدخل الهاتف بصيغة <span dir="ltr">091xxxxxxx</span> أو <span dir="ltr">+21891xxxxxxx</span>.
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
                onRefresh={load}
                onToast={onToast}
                onSendMessage={isTelegramActive(row) ? g => { setMessageTargets([g]); setShowMessageSheet(true) } : undefined}
              />
            ))}
          </ul>

          {showForm ? (
            formMode === 'invite' && newGuardian ? (
              <div className="guardian-form guardian-form--invite stack">
                <p className="guardian-form__invite-heading">
                  <i className="fa-solid fa-circle-check" aria-hidden /> تمت إضافة {newGuardian.name}
                </p>
                <GuardianInvitePanel
                  guardians={[newGuardian]}
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
                <div className="field">
                  <label>الاسم</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>الهاتف</label>
                  <input className="input" type="tel" dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="091xxxxxxx أو +21891xxxxxxx" required />
                  <p className="meta">يُحفظ الرقم بصيغة موحّدة تلقائياً (+218…).</p>
                </div>
                <div className="field">
                  <label>صلة القرابة (اختياري)</label>
                  <input className="input" value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="أب، أم، …" />
                </div>
                <div className="cluster">
                  <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                    {saving ? 'جاري الحفظ…' : 'حفظ ومتابعة'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={closeAddForm}>إلغاء</button>
                </div>
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
