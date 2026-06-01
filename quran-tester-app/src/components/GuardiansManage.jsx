import { useEffect, useMemo, useState } from 'react'
import { guardians } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import StatTile from './ui/StatTile.jsx'
import EmptyState from './ui/EmptyState.jsx'
import GuardianCard from './ui/GuardianCard.jsx'
import GuardianInvitePanel from './ui/GuardianInvitePanel.jsx'
import GuardianInviteModal from './ui/GuardianInviteModal.jsx'
import GuardianMessageSheet from './ui/GuardianMessageSheet.jsx'
import Toast from './ui/Toast.jsx'
import {
  filterGuardians,
  guardianStats,
  needsInvite,
  isTelegramActive,
  INVITE_CHANNELS,
  openGuardianInvite,
  inviteChannelToast,
} from '../lib/guardianUi.js'
import { useMessageSettings } from '../lib/MessageSettingsContext.jsx'

const STATUS_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'linked', label: 'مربوط' },
  { id: 'unlinked', label: 'غير مربوط' },
  { id: 'optout', label: 'غير مشترك' },
]

export default function GuardiansManage({ onBack, onOpenStudent }) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showSheet, setShowSheet] = useState(false)
  const [sheetStep, setSheetStep] = useState('form')
  const [createdGuardian, setCreatedGuardian] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkSelected, setBulkSelected] = useState(new Set())
  const [bulkChannel, setBulkChannel] = useState('whatsapp')
  const [bulkSending, setBulkSending] = useState(false)
  const [messageTargets, setMessageTargets] = useState([])
  const [showMessageSheet, setShowMessageSheet] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [inviteFallback, setInviteFallback] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { guardians: rows } = await guardians.list()
      setList(rows || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => guardianStats(list), [list])
  const filtered = useMemo(
    () => filterGuardians(list, { query, status: statusFilter }),
    [list, query, statusFilter]
  )
  const linkedList = useMemo(() => list.filter(isTelegramActive), [list])

  function openMessageSheet(guardians) {
    setMessageTargets(guardians)
    setShowMessageSheet(true)
  }

  function toggleSelectId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startSelectMode() {
    setSelectMode(true)
    setSelectedIds(new Set(linkedList.map(g => g.id)))
  }

  function openSelectedMessage() {
    const targets = linkedList.filter(g => selectedIds.has(g.id))
    if (!targets.length) {
      setToast('اختر ولياً مربوطاً واحداً على الأقل')
      return
    }
    openMessageSheet(targets)
  }

  const unlinkedList = useMemo(() => list.filter(needsInvite), [list])

  function openAddSheet() {
    setEditRow(null)
    setForm({ name: '', phone: '', notes: '' })
    setSheetStep('form')
    setCreatedGuardian(null)
    setShowSheet(true)
  }

  function openEditSheet(row) {
    setEditRow(row)
    setForm({ name: row.name || '', phone: row.phone_e164 || '', notes: row.notes || '' })
    setSheetStep('form')
    setCreatedGuardian(null)
    setShowSheet(true)
  }

  function closeSheet() {
    setShowSheet(false)
    setSheetStep('form')
    setCreatedGuardian(null)
  }

  async function finishInviteStep() {
    closeSheet()
    setToast('تمت الإضافة')
    await load()
  }

  async function handleSaveGuardian(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    setError('')
    try {
      if (editRow) {
        await guardians.update(editRow.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
        })
        setToast('تم التحديث')
        closeSheet()
        await load()
      } else {
        const { guardian } = await guardians.create({
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || null,
        })
        setCreatedGuardian(guardian)
        setSheetStep('invite')
        await load()
      }
    } catch (e) {
      if (e.status === 409 && e.existingGuardian) {
        const existing = e.existingGuardian
        setError(`${e.message} — ${existing.name} (${existing.phone_e164})`)
        if (!editRow) {
          openEditSheet({
            ...existing,
            students: existing.students || [],
            student_count: existing.student_count || 0,
            telegram_linked: existing.telegram_linked || false,
          })
        }
      } else {
        setError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  function openBulkInvite() {
    setBulkSelected(new Set(unlinkedList.map(g => g.id)))
    setBulkChannel('whatsapp')
    setShowBulk(true)
  }

  function toggleBulkId(id) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBulkInvite() {
    const targets = unlinkedList.filter(g => bulkSelected.has(g.id))
    if (!targets.length) {
      setToast('اختر ولياً واحداً على الأقل')
      return
    }
    setBulkSending(true)
    let sent = 0
    for (const g of targets) {
      try {
        const result = await guardians.createLinkCode(g.id)
        const inviteParams = {
          guardianName: g.name,
          studentName: g.students?.[0]?.name,
          deepLink: result.deepLink,
          code: result.code,
          sheikhName,
          masjidName,
        }
        const opened = openGuardianInvite(bulkChannel, {
          phoneE164: g.phone_e164,
          deepLink: result.deepLink,
          inviteParams,
        })
        if (opened.ok && !opened.error) sent++
      } catch {}
    }
    setBulkSending(false)
    setShowBulk(false)
    setToast(sent ? `تم فتح ${sent} دعوة — أرسل كل رسالة` : 'تعذر إرسال الدعوات')
  }

  return (
    <div className={`guardians-page stack ${selectMode ? 'guardians-page--selecting' : ''}`}>
      <PageHeader title="أولياء الأمور" subtitle="إدارة جهات الاتصال وربط Telegram" onBack={onBack} />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="guardians-stats">
        <StatTile label="إجمالي" value={stats.total} icon="fa-solid fa-users" />
        <StatTile label="مربوط" value={stats.linked} icon="fa-brands fa-telegram" tone="ok" />
        <StatTile label="بحاجة دعوة" value={stats.needsInvite} icon="fa-solid fa-paper-plane" tone="warn" />
      </div>

      <div className="guardians-panel">
        <div className="guardians-toolbar">
          <div className="guardians-toolbar__row">
            <div className="students-search guardians-toolbar__search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden />
              <input
                className="students-search__input"
                placeholder="بحث بالاسم أو الهاتف"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="بحث"
              />
              {query && (
                <button type="button" className="students-search__clear" aria-label="مسح" onClick={() => setQuery('')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
            <button type="button" className="btn btn--primary students-toolbar__add" aria-label="إضافة ولي" onClick={openAddSheet}>
              <i className="fa-solid fa-plus" />
            </button>
          </div>

          <div className="guardians-filter students-filter" role="tablist" aria-label="تصفية الحالة">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                className={`students-filter__chip ${statusFilter === f.id ? 'students-filter__chip--active' : ''}`}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="guardians-toolbar__footer">
            <p className="guardians-toolbar__count">
              {loading ? 'جاري التحميل…' : `${filtered.length} ولي أمر`}
            </p>
            <div className="guardians-toolbar__actions">
              {linkedList.length > 0 && !selectMode && (
                <button type="button" className="btn btn--ghost btn--sm guardians-toolbar__bulk" onClick={startSelectMode}>
                  <i className="fa-solid fa-paper-plane" /> رسالة مخصصة
                </button>
              )}
              {unlinkedList.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm guardians-toolbar__bulk" onClick={openBulkInvite}>
                  <i className="fa-solid fa-share-from-square" /> دعوة ({unlinkedList.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query.trim() || statusFilter !== 'all' ? 'لا نتائج' : 'لا يوجد أولياء أمور'}
          subtitle={query.trim() ? 'جرّب بحثاً مختلفاً' : 'اضغط + لإضافة ولي أمر'}
        />
      ) : (
        <ul className="guardian-list guardian-list--cards guardian-list--responsive student-list-panel">
          {filtered.map(row => (
            <GuardianCard
              key={row.id}
              row={row}
              variant="manage"
              expanded={expandedId === row.id}
              onToggleExpand={() => setExpandedId(id => id === row.id ? null : row.id)}
              onEdit={openEditSheet}
              onOpenStudent={onOpenStudent}
              onToast={msg => setToast(msg)}
              onRefresh={load}
              onSendMessage={!selectMode && isTelegramActive(row) ? g => openMessageSheet([g]) : undefined}
              selectMode={selectMode}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => toggleSelectId(row.id)}
            />
          ))}
        </ul>
      )}

      {showSheet && (
        <div className="sheet-modal" role="dialog" aria-modal="true" aria-label={editRow ? 'تعديل ولي' : sheetStep === 'invite' ? 'دعوة Telegram' : 'إضافة ولي'}>
          <div className="sheet-modal__backdrop" onClick={closeSheet} />
          <div className="sheet-modal__panel guardian-sheet">
            <div className="sheet-modal__handle" aria-hidden />
            {sheetStep === 'invite' && createdGuardian ? (
              <>
                <h3 className="sheet-modal__title">إرسال دعوة Telegram</h3>
                <p className="meta">تمت إضافة {createdGuardian.name} — أرسل الدعوة الآن.</p>
                <GuardianInvitePanel
                  guardians={[createdGuardian]}
                  compact
                  onToast={setToast}
                  onInviteFallback={setInviteFallback}
                />
                <div className="sheet-modal__actions">
                  <button type="button" className="btn btn--primary" onClick={finishInviteStep}>
                    تم
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="sheet-modal__title">{editRow ? 'تعديل ولي أمر' : 'إضافة ولي أمر'}</h3>
                <form className="stack" onSubmit={handleSaveGuardian}>
                  <label className="field">
                    <span className="field__label">الاسم</span>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                  </label>
                  <label className="field">
                    <span className="field__label">الهاتف</span>
                    <input className="input" type="tel" dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="091xxxxxxx أو +21891xxxxxxx" required />
                    <p className="meta">يُحفظ الرقم بصيغة موحّدة تلقائياً (+218…).</p>
                  </label>
                  <label className="field">
                    <span className="field__label">ملاحظات (اختياري)</span>
                    <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </label>
                  <div className="sheet-modal__actions">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? 'جاري الحفظ…' : 'حفظ ومتابعة'}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={closeSheet}>إلغاء</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showBulk && (
        <div className="sheet-modal" role="dialog" aria-modal="true" aria-label="دعوة جماعية">
          <div className="sheet-modal__backdrop" onClick={() => setShowBulk(false)} />
          <div className="sheet-modal__panel guardian-sheet">
            <div className="sheet-modal__handle" aria-hidden />
            <h3 className="sheet-modal__title">دعوة جماعية</h3>
            <p className="meta">اختر أولياء الأمور وطريقة الإرسال.</p>

            <div className="guardian-bulk-list">
              {unlinkedList.map(g => (
                <label key={g.id} className="guardian-bulk-item">
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(g.id)}
                    onChange={() => toggleBulkId(g.id)}
                  />
                  <span>{g.name}</span>
                  <span className="meta" dir="ltr">{g.phone_e164}</span>
                </label>
              ))}
            </div>

            <div className="guardian-card__invites" style={{ marginTop: 12 }}>
              {Object.values(INVITE_CHANNELS).map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  className={`btn guardian-invite-channels__btn guardian-invite-channels__btn--${ch.id} ${bulkChannel === ch.id ? 'guardian-invite-channels__btn--selected' : ''}`}
                  onClick={() => setBulkChannel(ch.id)}
                >
                  <i className={ch.icon} />
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>

            <div className="sheet-modal__actions">
              <button type="button" className="btn btn--primary" onClick={runBulkInvite} disabled={bulkSending}>
                {bulkSending ? 'جاري الإرسال…' : 'إرسال الدعوات'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowBulk(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectMode && (
        <div className="guardian-select-bar" role="toolbar" aria-label="اختيار أولياء للرسالة">
          <p className="guardian-select-bar__count">{selectedIds.size} محدد</p>
          <div className="guardian-select-bar__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={openSelectedMessage}>
              <i className="fa-solid fa-paper-plane" /> إرسال
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <GuardianMessageSheet
        open={showMessageSheet}
        guardians={messageTargets}
        onClose={() => setShowMessageSheet(false)}
        onToast={msg => setToast(msg)}
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
            setToast('تم نسخ الرسالة')
          } catch {
            setToast('تعذر النسخ')
          }
        }}
      />
    </div>
  )
}
