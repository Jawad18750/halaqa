import { useEffect, useMemo, useState } from 'react'
import { sessions, students, getApiUrl } from '../api'
import AvatarCropper from './AvatarCropper'
import {
  modeLabel,
  resultLabel,
  formatNaqza,
  formatThumunId,
  formatLocaleDateTime,
  formatAttemptDate,
  buildNaqzaLabels,
} from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import EmptyState from './ui/EmptyState.jsx'
import SessionCard from './ui/SessionCard.jsx'
import StudentHubHeader, { computeStudentStats } from './ui/StudentHubHeader.jsx'
import GuardianSection from './GuardianSection.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'
import Toast from './ui/Toast.jsx'

export default function StudentProfile({ student, thumuns = [], onBack, onTest, onHistory, onStudentUpdated }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg) }

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

  const [dob, setDob] = useState(toDateOnly(student?.date_of_birth))
  useEffect(() => { setDob(toDateOnly(student?.date_of_birth)) }, [student?.date_of_birth])

  const [photoUrl, setPhotoUrl] = useState(student?.photo_url || '')
  useEffect(() => {
    try {
      const ver = student?.updated_at ? new Date(student.updated_at).getTime() : Date.now()
      const base = student?.photo_url || ''
      if (base) setPhotoUrl(`${base}${base.includes('?') ? '&' : '?'}v=${ver}`)
    } catch {}
  }, [student?.photo_url, student?.updated_at])

  const naqzaLabels = buildNaqzaLabels(thumuns)
  const currentNaqzaLabel = formatNaqza(student?.current_naqza, thumuns, naqzaLabels)
  const stats = useMemo(() => computeStudentStats(list), [list])

  async function load() {
    setLoading(true); setError('')
    try {
      const { sessions: rows } = await sessions.forStudent(student.id)
      setList(rows)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [student?.id])

  async function saveDob() {
    try {
      let payloadDob = dob || null
      if (payloadDob?.includes('T')) payloadDob = payloadDob.split('T')[0]
      await students.update(student.id, { date_of_birth: payloadDob })
      showToast('تم حفظ تاريخ الميلاد')
    } catch (e) { setError(e.message) }
  }

  const [showCropper, setShowCropper] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)

  function onPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPendingFile(f)
    setShowCropper(true)
  }

  async function onCropped(file) {
    try {
      const { student: s } = await students.uploadPhoto(student.id, file)
      const ver = Date.now()
      setPhotoUrl(s.photo_url ? `${s.photo_url}?v=${ver}` : '')
      setShowCropper(false)
      setPendingFile(null)
      onStudentUpdated?.({ ...student, ...s })
      showToast('تم تحديث الصورة')
    } catch (e) { setError(e.message) }
  }

  const apiBase = getApiUrl()
  const placeholder = '/profile-placeholder.svg'
  const photoSrc = photoUrl
    ? (photoUrl.startsWith('http') ? photoUrl : `${apiBase}${photoUrl}`)
    : placeholder

  function buildRows() {
    return list.map(r => ({
      date: formatLocaleDateTime(formatAttemptDate(r)),
      thumunLabel: formatThumunId(r.thumun_id, thumuns),
      naqza: (() => {
        const t = thumuns.find(x => x.id === Number(r.thumun_id))
        return t?.naqza ? formatNaqza(t.naqza, thumuns, naqzaLabels) : ''
      })(),
      mode: modeLabel(r.mode),
      fatha: String(r.fatha_prompts ?? ''),
      taradud: String(r.taradud_count ?? ''),
      result: resultLabel(r.passed),
      score: String(r.score ?? ''),
    }))
  }

  function exportExcel() {
    try {
      const rows = buildRows()
      const title = `سجل الطالب — ${student.name}`
      const styles = `table{border-collapse:collapse;width:100%;direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}th,td{border:1px solid #ccd3db;padding:8px;text-align:center}thead th{background:#f3f6fa;font-weight:700}h1{font-size:18px;margin:0 0 10px}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><p>النقزة: ${currentNaqzaLabel}</p><table><thead><tr><th>التاريخ</th><th>الثمن</th><th>النقزة</th><th>الوضع</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th></tr></thead><tbody>`
      for (const r of rows) {
        html += `<tr><td>${r.date}</td><td>${r.thumunLabel}</td><td>${r.naqza}</td><td>${r.mode}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `student_${student.number}_attempts.xls`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
    } catch (e) { setError(String(e?.message || e)) }
  }

  function exportPDF() {
    try {
      const rows = buildRows()
      const title = `سجل الطالب — ${student.name}`
      const styles = `@page{size:A4;margin:16mm}body{direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3db;padding:6px;text-align:center}thead th{background:#f3f6fa}`
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<h1>${title}</h1><table><thead><tr><th>التاريخ</th><th>الثمن</th><th>الوضع</th><th>النتيجة</th><th>الدرجة</th></tr></thead><tbody>`
      for (const r of rows) {
        html += `<tr><td>${r.date}</td><td>${r.thumunLabel}</td><td>${r.mode}</td><td>${r.result}</td><td>${r.score}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const win = window.open('', '_blank')
      if (!win) return setError('تعذر فتح نافذة الطباعة')
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.focus(); win.print() }, 250)
    } catch (e) { setError(String(e?.message || e)) }
  }

  async function deleteSession(id) {
    if (!await confirmDialog('حذف المحاولة', 'هل تريد حذف هذه المحاولة؟')) return
    try {
      await sessions.remove(id)
      load()
    } catch (e) { setError(String(e.message || e)) }
  }

  return (
    <div className="stack">
      <PageHeader title="ملف الطالب" onBack={onBack} />

      <StudentHubHeader
        student={student}
        photoSrc={photoSrc}
        currentNaqzaLabel={currentNaqzaLabel}
        stats={stats}
        dob={dob}
        onDobChange={e => setDob(e.target.value)}
        onDobBlur={saveDob}
        onPhotoPick={onPick}
        actions={(
          <>
            {onTest && (
              <button type="button" className="btn btn--primary" onClick={onTest}>
                <i className="fa-solid fa-play" /> اختبار
              </button>
            )}
            {onHistory && (
              <button type="button" className="btn btn--ghost" onClick={onHistory}>
                <i className="fa-solid fa-clock-rotate-left" /> السجل الكامل
              </button>
            )}
          </>
        )}
      />

      {showCropper && pendingFile && (
        <AvatarCropper file={pendingFile} onCancel={() => { setShowCropper(false); setPendingFile(null) }} onCropped={onCropped} />
      )}

      <SectionCard title="أولياء الأمور">
        <GuardianSection student={student} onToast={showToast} />
      </SectionCard>

      <SectionCard
        title="آخر المحاولات"
        actions={(
          <div className="cluster">
            <button type="button" className="btn btn--sm btn--ghost" onClick={exportPDF} aria-label="تصدير PDF"><i className="fa-solid fa-file-pdf" /></button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={exportExcel} aria-label="تصدير Excel"><i className="fa-solid fa-file-excel" /></button>
          </div>
        )}
      >
        {error && <div className="alert alert--error" style={{ marginBottom: 8 }}>{error}</div>}
        {loading ? (
          <div className="loading">جاري التحميل…</div>
        ) : list.length === 0 ? (
          <EmptyState
            title="لا محاولات بعد"
            action={onTest && (
              <button type="button" className="btn btn--primary" onClick={onTest}>
                <i className="fa-solid fa-play" /> بدء اختبار
              </button>
            )}
          />
        ) : (
          <>
            <div className="session-list mobile-only">
              {list.slice(0, 5).map(r => (
                <SessionCard
                  key={r.id}
                  session={r}
                  thumuns={thumuns}
                  onDelete={() => deleteSession(r.id)}
                />
              ))}
            </div>
            {list.length > 5 && onHistory && (
              <button type="button" className="btn btn--ghost mobile-only" style={{ width: '100%', marginTop: 12 }} onClick={onHistory}>
                عرض كل السجل ({list.length} محاولة)
              </button>
            )}
            <div className="desktop-only profile-table-wrapper" style={{ marginTop: 16 }}>
              <table className="responsive-table profile-table">
                <thead>
                  <tr>
                    <th>التاريخ</th><th>الثمن</th><th>الوضع</th><th>النتيجة</th><th>الدرجة</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id}>
                      <td>{formatLocaleDateTime(formatAttemptDate(r))}</td>
                      <td>{formatThumunId(r.thumun_id, thumuns)}</td>
                      <td>{modeLabel(r.mode)}</td>
                      <td>{resultLabel(r.passed)}</td>
                      <td>{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
