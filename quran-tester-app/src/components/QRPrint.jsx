import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { attendance } from '../api'
import { QR_PRINT_SPECS } from '../lib/qrAttendance.js'
import PageHeader from './ui/PageHeader.jsx'

const PRINT_MODES = [
  { id: 'large', label: 'ملصقات كبيرة', hint: 'الأفضل للمسح' },
  { id: 'grid', label: 'A4 شبكة', hint: 'اقتصادي' },
  { id: 'single', label: 'طالب واحد', hint: 'لصق فردي' },
]

async function renderQrDataUrl(token, mode) {
  const spec = QR_PRINT_SPECS[mode] || QR_PRINT_SPECS.large
  return QRCode.toDataURL(token, {
    ...spec,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export default function QRPrint({ user, onBack }) {
  const [studentsList, setStudentsList] = useState([])
  const [mode, setMode] = useState('large')
  const [selectedId, setSelectedId] = useState('')
  const [codes, setCodes] = useState({ grid: {}, large: {}, single: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await attendance.stickers()
        if (cancelled) return
        const rows = data.students || []
        setStudentsList(rows)
        setSelectedId(rows[0]?.id || '')
        const nextCodes = { grid: {}, large: {}, single: {} }
        for (const student of rows) {
          const [grid, large, single] = await Promise.all([
            renderQrDataUrl(student.qr_token, 'grid'),
            renderQrDataUrl(student.qr_token, 'large'),
            renderQrDataUrl(student.qr_token, 'single'),
          ])
          nextCodes.grid[student.id] = grid
          nextCodes.large[student.id] = large
          nextCodes.single[student.id] = single
        }
        if (!cancelled) setCodes(nextCodes)
      } catch (e) {
        if (!cancelled) setError(e.message || 'تعذر تحميل الرموز')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const visibleStudents = useMemo(() => {
    if (mode === 'single') return studentsList.filter(student => student.id === selectedId)
    return studentsList
  }, [mode, selectedId, studentsList])

  const printClass = mode === 'large'
    ? 'qr-sheet qr-sheet--large'
    : mode === 'single'
      ? 'qr-sheet qr-sheet--single'
      : 'qr-sheet'

  const activeMode = PRINT_MODES.find(m => m.id === mode)

  return (
    <div className="qr-print-page">
      <PageHeader
        title="طباعة رموز الطلاب"
        subtitle="ملصقات A4 للقص واللصق على دفاتر الطلاب"
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()} disabled={loading || !visibleStudents.length}>
            <i className="fa-solid fa-print" /> طباعة
          </button>
        )}
      />

      {error && <div className="alert alert--error">{error}</div>}

      <p className="meta qr-print-tip">
        <i className="fa-solid fa-circle-info" aria-hidden />
        {' '}
        للمسح السريع على الهاتف: اختر <strong>ملصقات كبيرة</strong>، اطبع بحجم 100% (بدون تصغير)، والصق الرمز بعيدًا عن الحافة.
      </p>

      <section className="qr-print-controls">
        <div className="attendance-tabs" role="tablist" aria-label="تنسيق الطباعة">
          {PRINT_MODES.map(item => (
            <button
              key={item.id}
              type="button"
              className={`attendance-tab ${mode === item.id ? 'attendance-tab--active' : ''}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
              <span className="attendance-tab__hint">{item.hint}</span>
            </button>
          ))}
        </div>
        {mode === 'single' && (
          <select className="input qr-print-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {studentsList.map(student => (
              <option key={student.id} value={student.id}>{student.number}. {student.name}</option>
            ))}
          </select>
        )}
        {activeMode && (
          <p className="meta qr-print-mode-note">
            الوضع الحالي: {activeMode.label} — {activeMode.hint}
          </p>
        )}
      </section>

      {loading ? (
        <div className="loading">جاري تجهيز الرموز…</div>
      ) : (
        <section className={printClass} aria-label="معاينة الطباعة">
          {visibleStudents.map(student => (
            <article key={student.id} className="qr-sticker">
              <img src={codes[mode]?.[student.id]} alt="" className="qr-sticker__code" />
              <div className="qr-sticker__text">
                <strong>{student.name}</strong>
                <span>رقم {student.number}</span>
                {user?.masjid_name && <small>{user.masjid_name}</small>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
