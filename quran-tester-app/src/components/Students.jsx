import { useEffect, useMemo, useState, useRef } from 'react'
import { students, sessions, guardians, getApiUrl } from '../api'
import { buildNaqzaLabels } from '../lib/labels.js'
import { guardianCoverageStats, studentsMissingGuardian } from '../lib/guardianUi.js'
import { confirmDialog } from './ui/ConfirmDialog.jsx'
import EmptyState from './ui/EmptyState.jsx'
import StudentListItem from './ui/StudentListItem.jsx'
import Toast from './ui/Toast.jsx'

const WEEK_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'لم يُختبر' },
  { id: 'tested', label: 'مُختبر' },
]

export default function Students({ onSelect, onProfile, onAddStudent, onNavigate, onPrintQr, listFocus, onListFocusConsumed }) {
  const [list, setList] = useState([])
  const [guardianList, setGuardianList] = useState([])
  const [testedIds, setTestedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [weekFilter, setWeekFilter] = useState('all')
  const [guardianFocus, setGuardianFocus] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [editNumber, setEditNumber] = useState(1)
  const [editName, setEditName] = useState('')
  const [editNaqza, setEditNaqza] = useState(20)
  const [toast, setToast] = useState('')
  const [thumuns, setThumuns] = useState([])
  const listRef = useRef(null)

  const naqzaLabels = buildNaqzaLabels(thumuns)
  const placeholder = '/profile-placeholder.svg'

  const guardianMetrics = useMemo(
    () => guardianCoverageStats(guardianList, list),
    [guardianList, list]
  )

  function showToast(msg) { setToast(msg) }

  useEffect(() => {
    if (menuId == null) return
    function close(e) {
      if (listRef.current && !listRef.current.contains(e.target)) setMenuId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [studentsRes, weekly, guardiansRes] = await Promise.all([
        students.list(),
        sessions.weekly().catch(() => ({ sessions: [] })),
        guardians.list().catch(() => ({ guardians: [] })),
      ])
      setList(studentsRes?.students || [])
      setGuardianList(guardiansRes?.guardians || [])
      setTestedIds(new Set((weekly?.sessions || []).map(s => s.student_id)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (listFocus === 'no-guardian') {
      setGuardianFocus(true)
      onListFocusConsumed?.()
    }
  }, [listFocus, onListFocusConsumed])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r => r.json()).then(d => setThumuns(d.thumuns || [])).catch(() => {})
  }, [])

  function startEdit(s) {
    setEditingId(s.id)
    setEditNumber(s.number || 1)
    setEditName(s.name || '')
    setEditNaqza(s.current_naqza || 20)
    setMenuId(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setError('')
    try {
      const ok = await confirmDialog('تأكيد الحفظ', 'هل تريد حفظ تعديلات الطالب؟')
      if (!ok) return
      await students.update(editingId, { number: Number(editNumber), name: editName.trim(), current_naqza: Number(editNaqza) })
      setEditingId(null)
      showToast('تم الحفظ')
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeStudent(s) {
    try {
      const ok = await confirmDialog('تأكيد الحذف', 'هل تريد حذف الطالب؟')
      if (!ok) return
      await students.remove(s.id)
      showToast('تم الحذف')
      load()
    } catch (e) {
      setError(String(e.message || e))
    }
  }

  const notTestedCount = useMemo(
    () => list.filter(s => !testedIds.has(s.id)).length,
    [list, testedIds]
  )

  const missingGuardianStudents = useMemo(
    () => studentsMissingGuardian(guardianList, list),
    [guardianList, list]
  )

  const missingGuardianIds = useMemo(
    () => new Set(missingGuardianStudents.map(s => s.id)),
    [missingGuardianStudents]
  )

  const filtered = useMemo(() => {
    const q = query.trim()
    let base = q
      ? list.filter(s => String(s.number).includes(q) || (s.name || '').includes(q))
      : list
    if (guardianFocus) base = base.filter(s => missingGuardianIds.has(s.id))
    if (weekFilter === 'tested') base = base.filter(s => testedIds.has(s.id))
    if (weekFilter === 'pending') base = base.filter(s => !testedIds.has(s.id))
    return [...base].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
  }, [list, query, weekFilter, testedIds, guardianFocus, missingGuardianIds])

  function photoSrc(s) {
    if (!s?.photo_url) return placeholder
    let url = s.photo_url
    if (!url.includes('?')) {
      const ver = s?.updated_at ? new Date(s.updated_at).getTime() : Date.now()
      url = `${url}?v=${ver}`
    }
    const apiBase = getApiUrl()
    return url.startsWith('http') ? url : `${apiBase}${url}`
  }

  return (
    <div className="students-page">
      {guardianFocus && (
        <section className="students-guardian-focus" aria-label="إكمال بيانات أولياء الأمور">
          <div className="students-guardian-focus__main">
            <span className="students-guardian-focus__icon" aria-hidden>
              <i className="fa-solid fa-user-shield" />
            </span>
            <div className="students-guardian-focus__text">
              <strong>إكمال بيانات أولياء الأمور</strong>
              <p className="meta">
                {missingGuardianStudents.length > 0
                  ? `${missingGuardianStudents.length} طالب بدون ولي أمر — افتح ملف الطالب وأضف بيانات ولي الأمر من قسم «أولياء الأمور».`
                  : 'تم ربط جميع الطلاب بأولياء أمور.'}
              </p>
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setGuardianFocus(false)}>
            عرض كل الطلاب
          </button>
        </section>
      )}

      {!loading && list.length > 0 && !guardianFocus && (
        <section className="students-guardian-strip" aria-label="أولياء الأمور و Telegram">
          <div className="students-guardian-strip__main">
            <span className="students-guardian-strip__icon" aria-hidden>
              <i className="fa-brands fa-telegram" />
            </span>
            <div className="students-guardian-strip__text">
              <strong>إشعارات أولياء الأمور</strong>
              <p className="meta">
                {guardianMetrics.studentsWithoutGuardian > 0
                  ? `${guardianMetrics.studentsWithoutGuardian} طالب بدون ولي أمر · `
                  : ''}
                {guardianMetrics.needsInvite > 0
                  ? `${guardianMetrics.needsInvite} ولي أمر بحاجة دعوة Telegram`
                  : 'جميع أولياء الأمور المرتبطين جاهزون'}
              </p>
            </div>
          </div>
          <div className="students-guardian-strip__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('guardians')}>
              <i className="fa-solid fa-user-group" /> أولياء الأمور
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('broadcast')}>
              <i className="fa-solid fa-paper-plane" /> رسالة مخصصة
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPrintQr?.()}>
              <i className="fa-solid fa-qrcode" /> طباعة الرموز
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onAddStudent?.()}>
              <i className="fa-solid fa-user-plus" /> إضافة طالب
            </button>
          </div>
        </section>
      )}

      <div className="students-toolbar">
        <div className="students-toolbar__row">
          <div className="students-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input
              className="students-search__input"
              placeholder="بحث بالاسم أو الرقم"
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
          <button
            type="button"
            className="btn btn--primary students-toolbar__add"
            aria-label="إضافة طالب"
            onClick={() => onAddStudent?.()}
          >
            <i className="fa-solid fa-plus" />
          </button>
        </div>

        <div className="students-filter" role="tablist" aria-label="تصفية حسب الاختبار الأسبوعي">
          {WEEK_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={weekFilter === f.id}
              className={`students-filter__chip ${weekFilter === f.id ? 'students-filter__chip--active' : ''}`}
              onClick={() => setWeekFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="students-toolbar__meta">
          {loading
            ? 'جاري التحميل…'
            : guardianFocus
              ? `${filtered.length} طالب بدون ولي أمر`
              : `${filtered.length} طالب${weekFilter === 'all' ? ` · ${notTestedCount} لم يُختبر` : ''}`}
        </p>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={guardianFocus ? 'لا طلاب بدون ولي أمر' : query.trim() || weekFilter !== 'all' ? 'لا نتائج' : 'لا يوجد طلاب'}
          subtitle={guardianFocus
            ? 'جميع الطلاب لديهم ولي أمر مسجّل — يمكنك إرسال دعوات Telegram من صفحة أولياء الأمور.'
            : query.trim() ? 'جرّب بحثاً مختلفاً' : weekFilter === 'pending' ? 'جميع الطلاب اُختبروا هذا الأسبوع' : undefined}
          action={guardianFocus ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onNavigate?.('guardians')}>
              <i className="fa-solid fa-user-group" /> إدارة أولياء الأمور
            </button>
          ) : !query.trim() && weekFilter === 'all' && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onAddStudent?.()}>
              <i className="fa-solid fa-user-plus" /> إضافة أول طالب
            </button>
          )}
        />
      ) : (
        <ul className="student-list-panel" ref={listRef}>
          {filtered.map(s => (
            <StudentListItem
              key={s.id}
              student={s}
              photoSrc={photoSrc}
              placeholder={placeholder}
              naqzaLabels={naqzaLabels}
              testedThisWeek={testedIds.has(s.id)}
              missingGuardian={guardianFocus || missingGuardianIds.has(s.id)}
              editing={editingId === s.id}
              editNumber={editNumber}
              editName={editName}
              editNaqza={editNaqza}
              onEditNumber={setEditNumber}
              onEditName={setEditName}
              onEditNaqza={setEditNaqza}
              onSave={saveEdit}
              onCancelEdit={() => setEditingId(null)}
              onProfile={onProfile}
              onTest={onSelect}
              onStartEdit={startEdit}
              onDelete={removeStudent}
              menuOpen={menuId === s.id}
              onMenuToggle={() => setMenuId(id => id === s.id ? null : s.id)}
              onMenuClose={() => setMenuId(null)}
            />
          ))}
        </ul>
      )}

      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
