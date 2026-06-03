import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { attendance } from '../api'
import PageHeader from './ui/PageHeader.jsx'

const PRINT_MODES = [
  { id: 'grid', label: 'A4 شبكة' },
  { id: 'large', label: 'ملصقات كبيرة' },
  { id: 'single', label: 'طالب واحد' },
]

export default function QRPrint({ user, onBack }) {
  const [studentsList, setStudentsList] = useState([])
  const [mode, setMode] = useState('grid')
  const [selectedId, setSelectedId] = useState('')
  const [codes, setCodes] = useState({})
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
        const nextCodes = {}
        for (const student of rows) {
          nextCodes[student.id] = await QRCode.toDataURL(student.qr_token, {
            margin: 1,
            width: 320,
            errorCorrectionLevel: 'M',
          })
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

  const printClass = mode === 'large' ? 'qr-sheet qr-sheet--large' : mode === 'single' ? 'qr-sheet qr-sheet--single' : 'qr-sheet'

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
      </section>

      {loading ? (
        <div className="loading">جاري تجهيز الرموز…</div>
      ) : (
        <section className={printClass} aria-label="معاينة الطباعة">
          {visibleStudents.map(student => (
            <article key={student.id} className="qr-sticker">
              <img src={codes[student.id]} alt="" className="qr-sticker__code" />
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
