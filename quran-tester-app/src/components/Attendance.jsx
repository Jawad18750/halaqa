import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { attendance } from '../api'
import { parseQrAttendanceToken } from '../lib/qrAttendance.js'
import { decodeQrFromImageFile, startAttendanceScanner } from '../lib/attendanceScanner.js'
import PageHeader from './ui/PageHeader.jsx'
import Toast from './ui/Toast.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'

const MODES = [
  { id: 'scan', label: 'مسح' },
  { id: 'manual', label: 'يدوي' },
  { id: 'review', label: 'مراجعة' },
]

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function queueKey(date) {
  return `attendance-pending:${date}`
}

function readQueue(date) {
  try {
    const parsed = JSON.parse(localStorage.getItem(queueKey(date)) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(date, rows) {
  try {
    localStorage.setItem(queueKey(date), JSON.stringify(rows))
  } catch {
    // Local persistence is best-effort; autosave still attempts server sync.
  }
}

export default function Attendance({ onBack, onPrint }) {
  const [date, setDate] = useState(() => localDateString())
  const [mode, setMode] = useState('scan')
  const [studentsList, setStudentsList] = useState([])
  const [records, setRecords] = useState([])
  const [calendar, setCalendar] = useState(null)
  const [pending, setPending] = useState(() => readQueue(localDateString()))
  const [recent, setRecent] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastScanRef = useRef({ text: '', at: 0 })
  const studentByTokenRef = useRef(new Map())
  const presentIdsRef = useRef(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await attendance.today(date)
      setStudentsList(data.students || [])
      setRecords(data.records || [])
      setCalendar(data.calendar || null)
      const queued = readQueue(date)
      setPending(queued)
    } catch (e) {
      setError(e.message || 'تعذر تحميل الحضور')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    writeQueue(date, pending)
  }, [date, pending])

  const studentByToken = useMemo(() => {
    const map = new Map()
    for (const student of studentsList) {
      if (!student.qr_token) continue
      const token = String(student.qr_token).trim().toLowerCase()
      map.set(token, student)
      map.set(student.qr_token, student)
    }
    return map
  }, [studentsList])

  useEffect(() => {
    studentByTokenRef.current = studentByToken
  }, [studentByToken])

  const presentIds = useMemo(() => {
    const ids = new Set(records.map(r => r.student_id))
    for (const item of pending) if (item.studentId) ids.add(item.studentId)
    return ids
  }, [records, pending])

  useEffect(() => {
    presentIdsRef.current = presentIds
  }, [presentIds])

  const presentCount = presentIds.size
  const missingStudents = useMemo(
    () => studentsList.filter(s => !presentIds.has(s.id)),
    [studentsList, presentIds]
  )

  const filteredStudents = useMemo(() => {
    const q = query.trim()
    const base = q
      ? studentsList.filter(s => String(s.number).includes(q) || (s.name || '').includes(q))
      : studentsList
    return [...base].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
  }, [studentsList, query])

  async function flushPending(items = pending) {
    if (!items.length || saving) return
    setSaving(true)
    try {
      const result = await attendance.batchSave(date, items.map(item => ({ qrToken: item.qrToken, source: item.source })))
      const invalidTokens = new Set((result.invalid || []).map(item => item.qrToken))
      const unresolved = items.filter(item => invalidTokens.has(item.qrToken))
      setPending(unresolved)
      setRecords(prev => {
        const byId = new Map(prev.map(row => [row.id, row]))
        for (const row of result.saved || []) byId.set(row.id, row)
        return [...byId.values()]
      })
      if ((result.saved || []).length) setToast('تم حفظ الحضور')
      if (unresolved.length) setToast('بعض الرموز غير معروفة')
    } catch {
      setToast('سيتم الحفظ عند عودة الاتصال')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!pending.length) return undefined
    const t = setTimeout(() => flushPending(pending), 900)
    return () => clearTimeout(t)
  }, [pending, date]) // eslint-disable-line react-hooks/exhaustive-deps

  function addScan(qrToken, source = 'qr') {
    const token = parseQrAttendanceToken(qrToken)
    const student = studentByTokenRef.current.get(token)
      || studentByTokenRef.current.get(String(qrToken || '').trim())
    if (!student) {
      setToast('رمز غير معروف')
      return
    }
    if (presentIdsRef.current.has(student.id)) {
      setToast('تم التسجيل مسبقًا')
      return
    }
    const item = {
      id: `${Date.now()}-${student.id}`,
      qrToken: token,
      source,
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.number,
      at: new Date().toISOString(),
    }
    setPending(prev => [...prev, item])
    setRecent(prev => [item, ...prev].slice(0, 8))
    setToast(source === 'manual' ? 'تمت الإضافة يدويًا' : `تم تسجيل ${student.name}`)
  }

  function handleQrText(text) {
    const value = parseQrAttendanceToken(text)
    if (!value) return
    const now = Date.now()
    if (lastScanRef.current.text === value && now - lastScanRef.current.at < 1200) return
    lastScanRef.current = { text: value, at: now }
    addScan(value, 'qr')
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks?.()?.[0]
    if (!track || !BrowserQRCodeReader.mediaStreamIsTorchCompatibleTrack(track)) return
    const next = !torchOn
    try {
      await BrowserQRCodeReader.mediaStreamSetTorch(track, next)
      setTorchOn(next)
    } catch {
      setToast('تعذر تشغيل الفلاش')
    }
  }

  async function decodeFromPhoto(file) {
    if (!file) return
    try {
      const text = await decodeQrFromImageFile(file)
      if (text) handleQrText(text)
      else setToast('لم يُعثر على رمز QR في الصورة')
    } catch {
      setToast('لم يُعثر على رمز QR في الصورة')
    }
  }

  useEffect(() => {
    if (mode !== 'scan' || loading) {
      scannerRef.current?.stop?.()
      scannerRef.current = null
      streamRef.current = null
      setTorchOn(false)
      setTorchAvailable(false)
      return undefined
    }

    let cancelled = false

    async function startCamera() {
      setCameraError('')
      setTorchOn(false)
      setTorchAvailable(false)
      await new Promise(resolve => requestAnimationFrame(resolve))
      if (cancelled) return
      const video = videoRef.current
      if (!video) return

      scannerRef.current?.stop?.()
      scannerRef.current = startAttendanceScanner({
        video,
        onDetect: handleQrText,
        onStreamReady: (stream) => {
          if (cancelled) return
          streamRef.current = stream
          const track = stream.getVideoTracks()[0]
          setTorchAvailable(Boolean(
            track && BrowserQRCodeReader.mediaStreamIsTorchCompatibleTrack(track)
          ))
        },
        onError: (e) => {
          if (!cancelled) setCameraError(e?.message || 'تعذر فتح الكاميرا')
        },
      })
    }

    startCamera()

    return () => {
      cancelled = true
      scannerRef.current?.stop?.()
      scannerRef.current = null
      streamRef.current = null
    }
  }, [mode, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function removeRecord(record) {
    if (record.pendingId) {
      setPending(prev => prev.filter(item => item.id !== record.pendingId))
      return
    }
    const ok = await confirmDialog(
      'إزالة الحضور',
      `إزالة تسجيل حضور ${record.name || 'الطالب'}؟`,
      { confirmLabel: 'إزالة', cancelLabel: 'إلغاء' }
    )
    if (!ok) return
    try {
      await attendance.remove(record.id)
      setRecords(prev => prev.filter(row => row.id !== record.id))
      setToast('تم إزالة الحضور')
    } catch (e) {
      setToast(e.message || 'تعذر إزالة الحضور')
    }
  }

  async function removeStudentPresence(student) {
    const pendingItem = pending.find(item => item.studentId === student.id)
    if (pendingItem) {
      setPending(prev => prev.filter(item => item.id !== pendingItem.id))
      setToast('تم إزالة الحضور')
      return
    }
    const record = records.find(row => row.student_id === student.id)
    if (!record) return
    const ok = await confirmDialog(
      'إزالة الحضور',
      `إزالة تسجيل حضور ${student.name}؟`,
      { confirmLabel: 'إزالة', cancelLabel: 'إلغاء' }
    )
    if (!ok) return
    try {
      await attendance.remove(record.id)
      setRecords(prev => prev.filter(row => row.id !== record.id))
      setToast('تم إزالة الحضور')
    } catch (e) {
      setToast(e.message || 'تعذر إزالة الحضور')
    }
  }

  async function toggleManualStudent(student) {
    if (presentIds.has(student.id)) {
      await removeStudentPresence(student)
      return
    }
    addScan(student.qr_token, 'manual')
  }

  async function undoLast() {
    const lastPending = pending[pending.length - 1]
    if (lastPending) {
      setPending(prev => prev.slice(0, -1))
      setToast('تم التراجع')
      return
    }
    const lastRecord = records[0]
    if (lastRecord) await removeRecord(lastRecord)
  }

  async function finish() {
    await flushPending(pending)
    onBack?.()
  }

  const presentRows = useMemo(() => {
    const synced = records.map(row => ({
      id: row.id,
      studentId: row.student_id,
      name: row.student_name,
      number: row.student_number,
      source: row.source,
      at: row.recorded_at,
    }))
    const queued = pending.map(item => ({
      pendingId: item.id,
      studentId: item.studentId,
      name: item.studentName,
      number: item.studentNumber,
      source: item.source,
      at: item.at,
    }))
    return [...queued, ...synced].sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [records, pending])

  if (loading && !studentsList.length) return <div className="loading">جاري تحميل الحضور…</div>

  return (
    <div className="attendance-page">
      <PageHeader
        title="الحضور"
        subtitle={new Date(`${date}T12:00:00`).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={onPrint}>
            <i className="fa-solid fa-qrcode" /> طباعة الرموز
          </button>
        )}
      />

      {error && <div className="alert alert--error">{error}</div>}
      {calendar?.closed && (
        <div className="alert alert--warning attendance-closed">
          <i className="fa-solid fa-calendar-xmark" aria-hidden />
          <span>هذا اليوم خارج جدول الدراسة{calendar.reasons?.length ? `: ${calendar.reasons.join('، ')}` : ''}. يمكن تسجيل الحضور عند الحاجة.</span>
        </div>
      )}

      <section className="attendance-command">
        <label className="attendance-date">
          <span>تاريخ الحضور</span>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <div className="attendance-count">
          <strong>{presentCount.toLocaleString('ar-EG-u-nu-latn')}</strong>
          <span>حاضر من {studentsList.length.toLocaleString('ar-EG-u-nu-latn')}</span>
        </div>
        <div className="attendance-sync">
          <i className={`fa-solid ${pending.length ? 'fa-cloud-arrow-up' : 'fa-circle-check'}`} aria-hidden />
          <span>{pending.length ? `${pending.length} بانتظار الحفظ` : 'محفوظ'}</span>
        </div>
      </section>

      <div className="attendance-tabs" role="tablist" aria-label="وضع الحضور">
        {MODES.map(item => (
          <button
            key={item.id}
            type="button"
            className={`attendance-tab ${mode === item.id ? 'attendance-tab--active' : ''}`}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'scan' && (
        <section className="attendance-scan">
          <p className="meta attendance-scan-hint">
            قرّب رمز الطالب حتى يملأ المربع — ثبّت الهاتف لحظة وسيُسجَّل تلقائيًا.
          </p>
          <div className="attendance-camera">
            <video ref={videoRef} className="attendance-camera__video" muted playsInline autoPlay />
            <div className="attendance-camera__frame" aria-hidden>
              <span className="attendance-camera__frame-corners" />
              <span className="attendance-camera__frame-scan" />
            </div>
            <div className="attendance-camera__tools">
              {torchAvailable && (
                <button
                  type="button"
                  className={`btn btn--sm ${torchOn ? 'btn--primary' : 'btn--ghost'} attendance-camera__torch`}
                  onClick={toggleTorch}
                  aria-pressed={torchOn}
                  aria-label={torchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
                >
                  <i className={`fa-solid ${torchOn ? 'fa-lightbulb' : 'fa-bolt'}`} aria-hidden />
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost btn--sm attendance-camera__photo"
                onClick={() => fileInputRef.current?.click()}
                aria-label="مسح من صورة"
              >
                <i className="fa-solid fa-image" aria-hidden />
                <span>صورة</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="attendance-camera__file"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) decodeFromPhoto(file)
                e.target.value = ''
              }}
            />
            {cameraError && (
              <div className="attendance-camera__fallback">
                <i className="fa-solid fa-camera-rotate" aria-hidden />
                <p>{cameraError}</p>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setMode('manual')}>تسجيل يدوي</button>
              </div>
            )}
          </div>
          <div className="attendance-recent">
            <div className="attendance-section-head">
              <h2>آخر المسح</h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={undoLast} disabled={!pending.length && !records.length}>
                <i className="fa-solid fa-rotate-left" /> تراجع
              </button>
            </div>
            {recent.length ? recent.map(item => (
              <div key={item.id} className="attendance-row attendance-row--fresh">
                <span className="attendance-row__num">{item.studentNumber}</span>
                <strong>{item.studentName}</strong>
                <span className="meta">بانتظار الحفظ</span>
              </div>
            )) : <p className="meta">مرّر رموز الطلاب أمام الكاميرا.</p>}
          </div>
        </section>
      )}

      {mode === 'manual' && (
        <section className="attendance-manual">
          <div className="students-search attendance-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input className="students-search__input" value={query} onChange={e => setQuery(e.target.value)} placeholder="بحث بالاسم أو الرقم" />
          </div>
          <div className="attendance-list">
            {filteredStudents.map(student => {
              const present = presentIds.has(student.id)
              return (
                <button
                  key={student.id}
                  type="button"
                  className={`attendance-student ${present ? 'attendance-student--present' : ''}`}
                  onClick={() => toggleManualStudent(student)}
                >
                  <span className="attendance-row__num">{student.number}</span>
                  <strong>{student.name}</strong>
                  <span className="attendance-student__state">{present ? 'إزالة' : 'تسجيل'}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {mode === 'review' && (
        <section className="attendance-review">
          <div className="attendance-section-head">
            <h2>الحاضرون</h2>
            <span className="meta">{presentRows.length.toLocaleString('ar-EG-u-nu-latn')}</span>
          </div>
          <p className="meta attendance-review-hint">اضغط ✕ لإزالة حضور مسجّل بالخطأ (محفوظ أو بانتظار الحفظ).</p>
          <div className="attendance-list">
            {presentRows.map(row => (
              <div key={row.id || row.pendingId} className="attendance-row">
                <span className="attendance-row__num">{row.number}</span>
                <strong>{row.name}</strong>
                <span className="meta">{row.pendingId ? 'بانتظار الحفظ' : row.source === 'manual' ? 'يدوي' : 'QR'}</span>
                <button type="button" className="btn btn--ghost btn--icon" onClick={() => removeRecord(row)} aria-label="إزالة الحضور">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
          </div>
          <div className="attendance-section-head attendance-missing-head">
            <h2>غير مسجلين</h2>
            <span className="meta">{missingStudents.length.toLocaleString('ar-EG-u-nu-latn')}</span>
          </div>
          <div className="attendance-missing">
            {missingStudents.slice(0, 20).map(student => <span key={student.id}>{student.number}. {student.name}</span>)}
            {missingStudents.length > 20 && <span>+{missingStudents.length - 20}</span>}
          </div>
        </section>
      )}

      <div className="attendance-actions">
        <button type="button" className="btn btn--ghost" onClick={load} disabled={loading}>
          <i className="fa-solid fa-rotate" /> تحديث
        </button>
        <button type="button" className="btn btn--primary" onClick={finish} disabled={saving}>
          {saving ? 'جاري الحفظ…' : 'إنهاء'}
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}
