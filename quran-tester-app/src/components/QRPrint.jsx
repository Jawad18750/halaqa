import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { attendance } from '../api'
import {
  QR_FORMATS,
  QR_STUDENT_SCOPES,
  QR_STICKER_SIZES,
  getQrFormat,
  getQrLayout,
  getQrStickerSize,
  getQrCacheKey,
  getQrSpecForLayout,
  getQrSheetSizeVars,
  paginateItems,
} from '../lib/qrAttendance.js'
import PageHeader from './ui/PageHeader.jsx'

const LATN = 'ar-EG-u-nu-latn'

async function renderQrDataUrl(token, layout, size, format) {
  return QRCode.toDataURL(token, {
    ...getQrSpecForLayout(layout, size, format),
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

function Sticker({ student, codeUrl, user, compact, sized }) {
  return (
    <article className={`qr-sticker ${compact ? 'qr-sticker--compact' : ''} ${sized ? 'qr-sticker--sized' : ''}`}>
      {codeUrl
        ? <img src={codeUrl} alt="" className="qr-sticker__code" />
        : <div className="qr-sticker__code qr-sticker__code--loading" aria-hidden />}
      <div className="qr-sticker__text">
        <strong>{student.name}</strong>
        <span>رقم {student.number}</span>
        {user?.masjid_name && !compact && <small>{user.masjid_name}</small>}
      </div>
    </article>
  )
}

export default function QRPrint({ user, onBack }) {
  const [studentsList, setStudentsList] = useState([])
  const [formatId, setFormatId] = useState('grid')
  const [layoutId, setLayoutId] = useState('g4x3')
  const [sizeId, setSizeId] = useState('md')
  const [scope, setScope] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [singleId, setSingleId] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [codes, setCodes] = useState({})
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [error, setError] = useState('')
  const [previewPage, setPreviewPage] = useState(0)

  const format = useMemo(() => getQrFormat(formatId), [formatId])
  const layout = useMemo(() => getQrLayout(formatId, layoutId), [formatId, layoutId])
  const size = useMemo(() => getQrStickerSize(sizeId), [sizeId])
  const cacheKey = useMemo(() => getQrCacheKey(layout, size, format), [layout, size, format])
  const perPage = layout.cols * layout.rows
  const hasSizePicker = Boolean(format.hasSizePicker)
  const scanEase = hasSizePicker ? size.scanEase : layout.scanEase

  const visibleStudents = useMemo(() => {
    if (scope === 'one') {
      return studentsList.filter(s => s.id === singleId)
    }
    if (scope === 'selected') {
      return studentsList.filter(s => selectedIds.has(s.id))
    }
    return studentsList
  }, [scope, singleId, selectedIds, studentsList])

  const filteredForPick = useMemo(() => {
    const q = studentQuery.trim()
    if (!q) return studentsList
    return studentsList.filter(s =>
      String(s.number).includes(q) || (s.name || '').includes(q)
    )
  }, [studentsList, studentQuery])

  const pages = useMemo(
    () => paginateItems(visibleStudents, perPage),
    [visibleStudents, perPage]
  )

  const pageCount = pages.length
  const safePreviewPage = Math.min(previewPage, Math.max(0, pageCount - 1))
  const previewStudents = pages[safePreviewPage] ?? []

  const sheetStyle = useMemo(() => ({
    '--qr-cols': layout.cols,
    '--qr-rows': layout.rows,
    ...(hasSizePicker ? getQrSheetSizeVars(size) : {}),
  }), [layout, size, hasSizePicker])

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
        const firstId = rows[0]?.id || ''
        setSingleId(firstId)
        if (firstId) setSelectedIds(new Set([firstId]))
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

    const cached = codes[cacheKey] || {}
    const missing = visibleStudents.filter(s => !cached[s.id])
    if (!missing.length) return undefined

    async function generateMissing() {
      setLoadingCodes(true)
      try {
        const next = { ...cached }
        await Promise.all(missing.map(async (student) => {
          if (!student.qr_token) return
          next[student.id] = await renderQrDataUrl(student.qr_token, layout, size, format)
        }))
        if (!cancelled) {
          setCodes(prev => ({ ...prev, [cacheKey]: next }))
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'تعذر تجهيز الرموز')
      } finally {
        if (!cancelled) setLoadingCodes(false)
      }
    }

    generateMissing()
    return () => { cancelled = true }
  }, [cacheKey, layout, size, format, visibleStudents, loadingStudents, codes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPreviewPage(0)
  }, [formatId, layoutId, sizeId, scope, singleId, selectedIds])

  function selectFormat(id) {
    const f = getQrFormat(id)
    setFormatId(id)
    setLayoutId(f.layouts[0]?.id || '')
    if (f.defaultScope) setScope(f.defaultScope)
    else if (scope === 'selected' && selectedIds.size === 0) setScope('all')
  }

  function toggleStudent(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredForPick.map(s => s.id)))
  }

  const layoutCodes = codes[cacheKey] || {}
  const isCompact = perPage >= 9 && !hasSizePicker

  const codesReady = useMemo(() => {
    if (!visibleStudents.length) return false
    return visibleStudents.every(s => layoutCodes[s.id])
  }, [visibleStudents, layoutCodes])

  const scopeWarning = useMemo(() => {
    if (scope === 'selected' && selectedIds.size === 0) return 'اختر طالبًا واحدًا على الأقل.'
    if (scope === 'one' && !singleId) return 'اختر الطالب.'
    return ''
  }, [scope, selectedIds.size, singleId])

  const canPrint = !loadingStudents && visibleStudents.length > 0 && codesReady && !scopeWarning

  const sheetClass = [
    'qr-sheet',
    hasSizePicker ? 'qr-sheet--sized' : '',
    layout.cols === 1 && layout.rows === 1 ? 'qr-sheet--sparse' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="qr-print-page">
      <PageHeader
        title="طباعة رموز الطلاب"
        subtitle="اختر التنسيق، الطلاب، والحجم — ثم اطبع"
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

      {/* ── Step 2: Who to print ── */}
      <section className="qr-print-panel" aria-label="الطلاب المطلوبون">
        <h2 className="qr-print-panel__title">٢ — من تطبع؟</h2>
        <div className="qr-print-scopes" role="radiogroup" aria-label="نطاق الطلاب">
          {QR_STUDENT_SCOPES.map(item => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={scope === item.id}
              className={`qr-print-scope-chip ${scope === item.id ? 'qr-print-scope-chip--active' : ''}`}
              onClick={() => setScope(item.id)}
            >
              <i className={item.icon} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>

        {scope === 'one' && (
          <label className="field qr-print-student-pick">
            <span className="field__label">الطالب</span>
            <select
              className="input"
              value={singleId}
              onChange={e => setSingleId(e.target.value)}
              disabled={loadingStudents}
            >
              {studentsList.map(student => (
                <option key={student.id} value={student.id}>
                  {student.number}. {student.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {scope === 'selected' && (
          <div className="qr-print-student-pick-list">
            <div className="qr-print-student-pick-list__head">
              <span className="field__label">الطلاب المحددون ({selectedIds.size.toLocaleString(LATN)})</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={selectAllFiltered}>
                تحديد الكل
              </button>
            </div>
            <div className="students-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden />
              <input
                className="students-search__input"
                placeholder="بحث بالاسم أو الرقم"
                value={studentQuery}
                onChange={e => setStudentQuery(e.target.value)}
                aria-label="بحث طلاب"
              />
            </div>
            <div className="qr-print-student-pick-list__items">
              {filteredForPick.map(student => (
                <label key={student.id} className="qr-print-student-pick-list__item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span className="qr-print-student-pick-list__body">
                    <strong>{student.name}</strong>
                    <span className="meta">رقم {student.number}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {scopeWarning && <p className="meta qr-print-scope-warn">{scopeWarning}</p>}
      </section>

      {/* ── Step 3: Layout & size ── */}
      <section className="qr-print-panel" aria-label="تفاصيل التنسيق">
        <h2 className="qr-print-panel__title">
          {hasSizePicker ? '٣ — حجم الملصق وتوزيع الصفحة' : '٣ — شبكة الصفحة'}
        </h2>

        {hasSizePicker && (
          <div className="qr-print-sizes" role="radiogroup" aria-label="حجم الملصق">
            {QR_STICKER_SIZES.map(sz => (
              <button
                key={sz.id}
                type="button"
                role="radio"
                aria-checked={sizeId === sz.id}
                className={`qr-print-size-option ${sizeId === sz.id ? 'qr-print-size-option--active' : ''}`}
                onClick={() => setSizeId(sz.id)}
              >
                <span className="qr-print-size-option__label">{sz.label}</span>
                <span className="qr-print-size-option__sub">{sz.subtitle}</span>
                <ScanEaseMeter value={sz.scanEase} />
              </button>
            ))}
          </div>
        )}

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
              {!hasSizePicker && <ScanEaseMeter value={lay.scanEase} />}
            </button>
          ))}
        </div>

        {format.tip && (
          <p className="meta qr-print-tip">
            <i className="fa-solid fa-circle-info" aria-hidden />
            {' '}
            {format.tip}
          </p>
        )}
      </section>

      {/* ── Summary ── */}
      {!loadingStudents && visibleStudents.length > 0 && !scopeWarning && (
        <div className="qr-print-summary">
          <div className="qr-print-summary__item">
            <strong>{visibleStudents.length.toLocaleString(LATN)}</strong>
            <span>طالب</span>
          </div>
          <div className="qr-print-summary__item">
            <strong>{pageCount.toLocaleString(LATN)}</strong>
            <span>صفحة A4</span>
          </div>
          <div className="qr-print-summary__item">
            <strong>{perPage.toLocaleString(LATN)}</strong>
            <span>ملصق / صفحة</span>
          </div>
          {hasSizePicker && (
            <div className="qr-print-summary__item">
              <strong>{size.label}</strong>
              <span>حجم الملصق</span>
            </div>
          )}
          <div className="qr-print-summary__item qr-print-summary__item--ease">
            <ScanEaseMeter value={scanEase} />
            <span>سهولة المسح</span>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      <section className="qr-print-preview-wrap" aria-label="معاينة الطباعة">
        <div className="qr-print-preview-head">
          <h2 className="qr-print-panel__title">٤ — المعاينة</h2>
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
        ) : scopeWarning ? (
          <p className="meta">{scopeWarning}</p>
        ) : loadingCodes && !codesReady ? (
          <div className="loading">جاري تجهيز الرموز…</div>
        ) : !visibleStudents.length ? (
          <p className="meta">لا يوجد طلاب لعرضهم.</p>
        ) : (
          <div className="qr-print-preview-stage">
            <div
              className={`${sheetClass} qr-sheet--preview`}
              style={sheetStyle}
              data-layout={layout.id}
              data-has-size={hasSizePicker ? 'true' : 'false'}
            >
              {previewStudents.map(student => (
                <Sticker
                  key={student.id}
                  student={student}
                  codeUrl={layoutCodes[student.id]}
                  user={user}
                  compact={isCompact}
                  sized={hasSizePicker}
                />
              ))}
            </div>
            <p className="meta qr-print-preview-note">
              المعاينة على الشاشة — عند الطباعة تُطبَع كل الصفحات ({pageCount.toLocaleString(LATN)}).
            </p>
          </div>
        )}
      </section>

      {/* ── Print-only pages ── */}
      <div className="qr-print-sheets" aria-hidden>
        {pages.map((pageStudents, pageIdx) => (
          <section
            key={pageIdx}
            className={`${sheetClass} qr-sheet--print`}
            style={sheetStyle}
            data-layout={layout.id}
            data-has-size={hasSizePicker ? 'true' : 'false'}
          >
            {pageStudents.map(student => (
              <Sticker
                key={student.id}
                student={student}
                codeUrl={layoutCodes[student.id]}
                user={user}
                compact={isCompact}
                sized={hasSizePicker}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
