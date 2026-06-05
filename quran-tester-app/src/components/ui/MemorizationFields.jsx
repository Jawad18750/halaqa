import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMemorizationFromThumun } from '../../lib/labels.js'

const RESULT_LIMIT = 24

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase()
}

function matchesThumun(t, q, surahFilter) {
  if (surahFilter && t.surah !== surahFilter) return false
  if (!q) return false
  const idStr = String(t.id)
  const name = String(t.name || '').toLowerCase()
  const surah = String(t.surah || '').toLowerCase()
  if (/^\d+$/.test(q)) return idStr.startsWith(q)
  return idStr.includes(q) || name.includes(q) || surah.includes(q)
}

export default function MemorizationFields({
  thumuns = [],
  value,
  onChange,
  disabled = false,
  idPrefix = 'mem',
  embedded = false,
}) {
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const searchRef = useRef(null)

  const selected = useMemo(
    () => thumuns.find(t => Number(t.id) === Number(value)) || null,
    [thumuns, value]
  )

  const surahOptions = useMemo(() => {
    const set = new Set()
    for (const t of thumuns) if (t.surah) set.add(t.surah)
    return [...set]
  }, [thumuns])

  const [surahFilter, setSurahFilter] = useState('')

  const { results, totalHits, surahOnly } = useMemo(() => {
    if (!pickerOpen) return { results: [], totalHits: 0, surahOnly: false }
    const q = normalizeQuery(query)
    if (!q && !surahFilter) return { results: [], totalHits: 0, surahOnly: false }

    const onlySurah = Boolean(surahFilter && !q)
    const hits = thumuns.filter(t => {
      if (onlySurah) return t.surah === surahFilter
      return matchesThumun(t, q, surahFilter || null)
    })
    const sorted = onlySurah ? [...hits].sort((a, b) => a.id - b.id) : hits
    const capped = onlySurah ? sorted : sorted.slice(0, RESULT_LIMIT)
    return { results: capped, totalHits: hits.length, surahOnly: onlySurah }
  }, [thumuns, query, surahFilter, pickerOpen])

  const resultHint = useMemo(() => {
    if (!pickerOpen) return ''
    const q = normalizeQuery(query)
    if (!q && !surahFilter) return 'ابحث برقم الثمن أو اسم السورة، أو اختر سورة من القائمة'
    if (!results.length) return 'لا نتائج — جرّب رقمًا أو كلمة أخرى'
    if (surahOnly) return `${totalHits} ثمن في ${surahFilter}`
    if (totalHits > RESULT_LIMIT) return `عرض ${RESULT_LIMIT} من ${totalHits} — دقّق البحث`
    return `${totalHits} نتيجة`
  }, [pickerOpen, query, surahFilter, results.length, totalHits, surahOnly])

  useEffect(() => {
    if (pickerOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQuery('')
    setSurahFilter('')
    return undefined
  }, [pickerOpen])

  function pick(id) {
    onChange?.(id == null ? null : Number(id))
    setPickerOpen(false)
    setQuery('')
    setSurahFilter('')
  }

  function openPicker() {
    if (disabled) return
    setPickerOpen(true)
  }

  const selectedLabel = formatMemorizationFromThumun(value, thumuns)

  return (
    <div className="memorization-fields">
      {!embedded && (
        <div className="memorization-fields__head">
          <span className="field__label">مستوى الحفظ (التسميع)</span>
        </div>
      )}
      <p className="memorization-fields__hint meta">موضع التسميع — منفصل عن النقزة والاختبار</p>

      <div className={`memorization-fields__summary ${selected ? 'memorization-fields__summary--set' : 'memorization-fields__summary--empty'}`}>
        {selected ? (
          <>
            <div className="memorization-fields__summary-main">
              <span className="memorization-fields__badge">#{selected.id}</span>
              <div className="memorization-fields__summary-text">
                <span className="memorization-fields__surah">{selected.surah || '—'}</span>
                <span className="memorization-fields__verse">{selected.name}</span>
              </div>
            </div>
            <div className="memorization-fields__summary-actions">
              <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={openPicker}>
                <i className="fa-solid fa-pen" aria-hidden /> تغيير
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => pick(null)}>
                مسح
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="memorization-fields__empty-label">لم يُحدد موضع التسميع بعد</p>
            <button type="button" className="btn btn--primary btn--sm" disabled={disabled} onClick={openPicker}>
              <i className="fa-solid fa-book-quran" aria-hidden /> اختيار الثمن
            </button>
          </>
        )}
      </div>

      {pickerOpen && (
        <div className="memorization-fields__picker" role="dialog" aria-label="اختيار مستوى الحفظ">
          <div className="memorization-fields__picker-head">
            <span className="memorization-fields__picker-title">اختيار الثمن</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm memorization-fields__picker-close"
              aria-label="إغلاق"
              onClick={() => setPickerOpen(false)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="memorization-fields__filters">
            <label className="memorization-fields__search-wrap">
              <i className="fa-solid fa-magnifying-glass memorization-fields__search-icon" aria-hidden />
              <input
                ref={searchRef}
                id={`${idPrefix}-search`}
                className="input memorization-fields__search"
                type="search"
                inputMode="search"
                placeholder="رقم الثمن، السورة، أو بداية الآية"
                value={query}
                disabled={disabled}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <select
              className="input memorization-fields__surah-filter"
              value={surahFilter}
              disabled={disabled}
              onChange={e => setSurahFilter(e.target.value)}
              aria-label="تصفية حسب السورة"
            >
              <option value="">كل السور</option>
              {surahOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {resultHint && (
            <p className={`memorization-fields__result-hint meta ${results.length ? '' : 'memorization-fields__result-hint--idle'}`}>
              {resultHint}
            </p>
          )}

          {results.length > 0 && (
            <ul className="memorization-fields__results" role="listbox" aria-label="نتائج البحث">
              {results.map(t => {
                const active = Number(value) === Number(t.id)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={`memorization-fields__result ${active ? 'memorization-fields__result--active' : ''}`}
                      onClick={() => pick(t.id)}
                    >
                      <span className="memorization-fields__result-id">#{t.id}</span>
                      <span className="memorization-fields__result-body">
                        <span className="memorization-fields__result-surah">{t.surah}</span>
                        <span className="memorization-fields__result-name">{t.name}</span>
                      </span>
                      {active && <i className="fa-solid fa-check memorization-fields__result-check" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {selected && !results.length && normalizeQuery(query) && (
            <p className="meta memorization-fields__current-ref">
              الحالي: {selectedLabel || `#${selected.id}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
