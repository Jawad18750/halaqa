import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { attendance } from '../api'
import {
  QR_FORMATS,
  getQrFormat,
  getQrLayout,
  getQrSpecForLayout,
  paginateItems,
} from '../lib/qrAttendance.js'
import PageHeader from './ui/PageHeader.jsx'

const LATN = 'ar-EG-u-nu-latn'

async function renderQrDataUrl(token, layout) {
  return QRCode.toDataURL(token, {
    ...getQrSpecForLayout(layout),
    color: { dark: '#000000', light: '#ffffff' },
  })
}

function ScanEaseMeter({ value }) {
  const n = Math.max(1, Math.min(5, Number(value) || 1))
  return (
    <span className="qr-scan-ease" aria-label={`سهولة المسح: ${n} من 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <i
          key={i}
          className={i < n ? 'fa-solid fa-star' : 'fa-regular fa-star qr-scan-ease__off'}
          aria-hidden
        />
      ))}
    </span>
  )
}

function LayoutThumb({ cols, rows, active }) {
  const cells = cols * rows
  return (
    <div
      className={`qr-layout-thumb ${active ? 'qr-layout-thumb--active' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-hidden
    >
      {Array.from({ length: cells }).map((_, i) => (
        <span key={i} className="qr-layout-thumb__cell" />
      ))}
    </div>
  )
}

function Sticker({ student, codeUrl, user, compact }) {
  return (
    <article className={`qr-sticker ${compact ? 'qr-sticker--compact' : ''}`}>
      {codeUrl
        ? <img src={codeUrl} alt="" className="qr-sticker__code" />
        : <div className="qr-sticker__code qr-sticker__code--loading" aria-hidden />}
      <div className="qr-sticker__text">
        <strong>{student.name}</strong>
        <span>رقم {student.number}</span>
        {user?.masjid_name && <small>{user.masjid_name}</small>}
      </div>
    </article>
  )
}

export default function QRPrint({ user, onBack }) {
  const [studentsList, setStudentsList] = useState([])
  const [formatId, setFormatId] = useState('grid')
  const [layoutId, setLayoutId] = useState('g4x3')
  const [selectedId, setSelectedId] = useState('')
  const [codes, setCodes] = useState({})
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [error, setError] = useState('')
  const [previewPage, setPreviewPage] = useState(0)

  const format = useMemo(() => getQrFormat(formatId), [formatId])
  const layout = useMemo(() => getQrLayout(formatId, layoutId), [formatId, layoutId])
  const perPage = layout.cols * layout.rows

  const visibleStudents = useMemo(() => {
    if (formatId === 'single') {
      return studentsList.filter(s => s.id === selectedId)
    }
    return studentsList
  }, [formatId, selectedId, studentsList])

  const pages = useMemo(
    () => paginateItems(visibleStudents, perPage),
    [visibleStudents, perPage]
  )

  const pageCount = pages.length
  const safePreviewPage = Math.min(previewPage, Math.max(0, pageCount - 1))
  const previewStudents = pages[safePreviewPage] ?? []

  // Load student list once
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingStudents(true)
      setError('')
      try {
        const data = await attendance.stickers()
        if (cancelled) return
        const rows = data.students || []
        setStudentsList(rows)
        setSelectedId(rows[0]?.id || '')
      } catch (e) {
        if (!cancelled) setError(e.message || 'تعذر تحميل الرموز')
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (loadingStudents || !visibleStudents.length) return undefined
    let cancelled = false

    const cached = codes[layout.id] || {}
    const missing = visibleStudents.filter(s => !cached[s.id])
    if (!missing.length) return undefined

    async function generateMissing() {
      setLoadingCodes(true)
      try {
        const next = { ...cached }
        await Promise.all(missing.map(async (student) => {
          if (!student.qr_token) return
          next[student.id] = await renderQrDataUrl(student.qr_token, layout)
        }))
        if (!cancelled) {
          setCodes(prev => ({ ...prev, [layout.id]: next }))
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'تعذر تجهيز الرموز')
      } finally {
        if (!cancelled) setLoadingCodes(false)
      }
    }

    generateMissing()
    return () => { cancelled = true }
  }, [layout, visibleStudents, loadingStudents, codes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset preview page when layout or format changes
  useEffect(() => {
    setPreviewPage(0)
  }, [formatId, layoutId, selectedId])

  // When format changes, pick sensible default layout
  function selectFormat(id) {
    setFormatId(id)
    const f = getQrFormat(id)
    setLayoutId(f.layouts[0]?.id || '')
  }

  const layoutCodes = codes[layout.id] || {}
  const isCompact = perPage >= 12

  const codesReady = useMemo(() => {
    if (!visibleStudents.length) return false
    return visibleStudents.every(s => layoutCodes[s.id])
  }, [visibleStudents, layoutCodes])

  const canPrint = !loadingStudents && visibleStudents.length > 0 && codesReady

  return (
    <div className="qr-print-page">
      <PageHeader
        title="طباعة رموز الطلاب"
        subtitle="اختر التنسيق، اعرض المعاينة، ثم اطبع"
        onBack={onBack}
        actions={(
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => window.print()}
            disabled={!canPrint}
          >
            <i className="fa-solid fa-print" /> طباعة
          </button>
        )}
      />

      {error && <div className="alert alert--error">{error}</div>}

      {/* ── Step 1: Format ── */}
      <section className="qr-print-panel" aria-label="نوع الطباعة">
        <h2 className="qr-print-panel__title">١ — نوع الطباعة</h2>
        <div className="qr-print-formats" role="radiogroup" aria-label="نوع الطباعة">
          {QR_FORMATS.map(f => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={formatId === f.id}
              className={`qr-print-format-card ${formatId === f.id ? 'qr-print-format-card--active' : ''}`}
              onClick={() => selectFormat(f.id)}
            >
              <i className={`${f.icon} qr-print-format-card__icon`} aria-hidden />
              <span className="qr-print-format-card__label">{f.label}</span>
              <span className="qr-print-format-card__desc">{f.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Step 2: Layout or student ── */}
      <section className="qr-print-panel" aria-label="تفاصيل التنسيق">
        <h2 className="qr-print-panel__title">
          {formatId === 'single'
            ? '٢ — اختر الطالب'
            : formatId === 'large'
              ? '٢ — حجم الملصق'
              : '٢ — شبكة الصفحة'}
        </h2>

        {formatId === 'single' ? (
          <label className="field qr-print-student-pick">
            <span className="field__label">الطالب</span>
            <select
              className="input"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={loadingStudents}
            >
              {studentsList.map(student => (
                <option key={student.id} value={student.id}>
                  {student.number}. {student.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="qr-print-layouts" role="radiogroup" aria-label="شبكة الصفحة">
            {format.layouts.map(lay => (
              <button
                key={lay.id}
                type="button"
                role="radio"
                aria-checked={layoutId === lay.id}
                className={`qr-print-layout-option ${layoutId === lay.id ? 'qr-print-layout-option--active' : ''}`}
                onClick={() => setLayoutId(lay.id)}
              >
                <LayoutThumb cols={lay.cols} rows={lay.rows} active={layoutId === lay.id} />
                <span className="qr-print-layout-option__label">{lay.label}</span>
                <span className="qr-print-layout-option__sub">{lay.subtitle}</span>
                <ScanEaseMeter value={lay.scanEase} />
              </button>
            ))}
          </div>
        )}

        {format.tip && (
          <p className="meta qr-print-tip">
            <i className="fa-solid fa-circle-info" aria-hidden />
            {' '}
            {format.tip}
          </p>
        )}
      </section>

      {/* ── Summary bar ── */}
      {!loadingStudents && visibleStudents.length > 0 && (
        <div className="qr-print-summary">
          <div className="qr-print-summary__item">
            <strong>{visibleStudents.length.toLocaleString(LATN)}</strong>
            <span>{formatId === 'single' ? 'طالب' : 'طالب'}</span>
          </div>
          <div className="qr-print-summary__item">
            <strong>{pageCount.toLocaleString(LATN)}</strong>
            <span>صفحة A4</span>
          </div>
          <div className="qr-print-summary__item">
            <strong>{perPage.toLocaleString(LATN)}</strong>
            <span>ملصق / صفحة</span>
          </div>
          <div className="qr-print-summary__item qr-print-summary__item--ease">
            <ScanEaseMeter value={layout.scanEase} />
            <span>سهولة المسح</span>
          </div>
        </div>
      )}

      {/* ── Preview (screen only) ── */}
      <section className="qr-print-preview-wrap" aria-label="معاينة الطباعة">
        <div className="qr-print-preview-head">
          <h2 className="qr-print-panel__title">٣ — المعاينة</h2>
          {pageCount > 1 && (
            <div className="qr-print-pager">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={safePreviewPage <= 0}
                onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                aria-label="الصفحة السابقة"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
              <span className="meta">
                صفحة {(safePreviewPage + 1).toLocaleString(LATN)} من {pageCount.toLocaleString(LATN)}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={safePreviewPage >= pageCount - 1}
                onClick={() => setPreviewPage(p => Math.min(pageCount - 1, p + 1))}
                aria-label="الصفحة التالية"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
            </div>
          )}
        </div>

        {loadingStudents ? (
          <div className="loading">جاري تحميل الطلاب…</div>
        ) : loadingCodes && !codesReady ? (
          <div className="loading">جاري تجهيز الرموز…</div>
        ) : !visibleStudents.length ? (
          <p className="meta">لا يوجد طلاب لعرضهم.</p>
        ) : (
          <div className="qr-print-preview-stage">
            <div
              className="qr-sheet qr-sheet--preview"
              style={{
                '--qr-cols': layout.cols,
                '--qr-rows': layout.rows,
              }}
              data-layout={layout.id}
            >
              {previewStudents.map(student => (
                <Sticker
                  key={student.id}
                  student={student}
                  codeUrl={layoutCodes[student.id]}
                  user={user}
                  compact={isCompact}
                />
              ))}
              {/* Empty placeholder cells so the grid shape is visible on partial last pages */}
              {Array.from({ length: Math.max(0, perPage - previewStudents.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="qr-sticker qr-sticker--empty" aria-hidden />
              ))}
            </div>
            <p className="meta qr-print-preview-note">
              المعاينة على الشاشة — عند الطباعة تُطبَع كل الصفحات ({pageCount.toLocaleString(LATN)}).
            </p>
          </div>
        )}
      </section>

      {/* ── Print-only: all pages ── */}
      <div className="qr-print-sheets" aria-hidden>
        {pages.map((pageStudents, pageIdx) => (
          <section
            key={pageIdx}
            className="qr-sheet qr-sheet--print"
            style={{
              '--qr-cols': layout.cols,
              '--qr-rows': layout.rows,
            }}
            data-layout={layout.id}
          >
            {pageStudents.map(student => (
              <Sticker
                key={student.id}
                student={student}
                codeUrl={layoutCodes[student.id]}
                user={user}
                compact={isCompact}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
