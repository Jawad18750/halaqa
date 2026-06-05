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
  thumunId = null,
  surah = null,
  onChange,
  disabled = false,
  idPrefix = 'mem',
  embedded = false,
}) {
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState('thumun')
  const searchRef = useRef(null)

  const hasThumun = thumunId != null && thumunId !== ''
  const hasSurah = Boolean(surah)
  const hasValue = hasThumun || hasSurah

  const selectedThumun = useMemo(
    () => (hasThumun ? thumuns.find(t => Number(t.id) === Number(thumunId)) : null),
    [thumuns, thumunId, hasThumun]
  )

  const surahList = useMemo(() => {
    const map = new Map()
    for (const t of thumuns) {
      if (!t.surah) continue
      if (!map.has(t.surah)) map.set(t.surah, Number(t.surahNumber) || 999)
    }
    return [...map.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name)
  }, [thumuns])

  const surahOptions = surahList

  const [surahFilter, setSurahFilter] = useState('')

  const filteredSurahs = useMemo(() => {
    const q = normalizeQuery(query)
    if (!q) return surahList
    return surahList.filter(name => name.toLowerCase().includes(q))
  }, [surahList, query])

  const { results, totalHits, surahOnly } = useMemo(() => {
    if (!pickerOpen || pickerMode !== 'thumun') return { results: [], totalHits: 0, surahOnly: false }
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
  }, [thumuns, query, surahFilter, pickerOpen, pickerMode])

  const resultHint = useMemo(() => {
    if (!pickerOpen) return ''
    if (pickerMode === 'surah') {
      if (!filteredSurahs.length) return 'لا نتائج — جرّب اسم سورة أخرى'
      return `${filteredSurahs.length} سورة`
    }
    const q = normalizeQuery(query)
    if (!q && !surahFilter) return 'ابحث برقم الثمن أو اسم السورة، أو اختر سورة من القائمة'
    if (!results.length) return 'لا نتائج — جرّب رقمًا أو كلمة أخرى'
    if (surahOnly) return `${totalHits} ثمن في ${surahFilter}`
    if (totalHits > RESULT_LIMIT) return `عرض ${RESULT_LIMIT} من ${totalHits} — دقّق البحث`
    return `${totalHits} نتيجة`
  }, [pickerOpen, pickerMode, query, surahFilter, results.length, totalHits, surahOnly, filteredSurahs.length])

  useEffect(() => {
    if (pickerOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQuery('')
    setSurahFilter('')
    return undefined
  }, [pickerOpen])

  function emitThumun(id) {
    onChange?.({ memorization_thumun_id: id == null ? null : Number(id), memorization_surah: null })
  }

  function emitSurah(name) {
    onChange?.({ memorization_thumun_id: null, memorization_surah: name || null })
  }

  function clear() {
    onChange?.({ memorization_thumun_id: null, memorization_surah: null })
    setPickerOpen(false)
    setQuery('')
    setSurahFilter('')
  }

  function openPicker(mode = hasSurah && !hasThumun ? 'surah' : 'thumun') {
    if (disabled) return
    setPickerMode(mode)
    setPickerOpen(true)
  }

  const selectedThumunLabel = formatMemorizationFromThumun(thumunId, thumuns)

  return (
    <div className="memorization-fields">
      {!embedded && (
        <div className="memorization-fields__head">
          <span className="field__label">مستوى الحفظ (التسميع)</span>
        </div>
      )}
      <p className="memorization-fields__hint meta">موضع التسميع — ثمن أو سورة كاملة (للسور القصيرة) — منفصل عن النقزة والاختبار</p>

      <div className={`memorization-fields__summary ${hasValue ? 'memorization-fields__summary--set' : 'memorization-fields__summary--empty'}`}>
        {hasValue ? (
          <>
            <div className="memorization-fields__summary-main">
              {hasThumun ? (
                <>
                  <span className="memorization-fields__badge">#{selectedThumun?.id ?? thumunId}</span>
                  <div className="memorization-fields__summary-text">
                    <span className="memorization-fields__surah">{selectedThumun?.surah || '—'}</span>
                    <span className="memorization-fields__verse">{selectedThumun?.name || selectedThumunLabel}</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="memorization-fields__badge memorization-fields__badge--surah">سورة</span>
                  <div className="memorization-fields__summary-text">
                    <span className="memorization-fields__surah">{surah}</span>
                    <span className="memorization-fields__verse meta">موضع بالسورة — دون تحديد ثمن</span>
                  </div>
                </>
              )}
            </div>
            <div className="memorization-fields__summary-actions">
              <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => openPicker()}>
                <i className="fa-solid fa-pen" aria-hidden /> تغيير
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={clear}>
                مسح
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="memorization-fields__empty-label">لم يُحدد موضع التسميع بعد</p>
            <div className="memorization-fields__empty-actions cluster">
              <button type="button" className="btn btn--primary btn--sm" disabled={disabled} onClick={() => openPicker('thumun')}>
                <i className="fa-solid fa-book-quran" aria-hidden /> اختيار ثمن
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => openPicker('surah')}>
                اختيار سورة
              </button>
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <div className="memorization-fields__picker" role="dialog" aria-label="اختيار مستوى الحفظ">
          <div className="memorization-fields__picker-head">
            <span className="memorization-fields__picker-title">اختيار موضع التسميع</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm memorization-fields__picker-close"
              aria-label="إغلاق"
              onClick={() => setPickerOpen(false)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="memorization-fields__mode-tabs" role="tablist" aria-label="نوع الموضع">
            <button
              type="button"
              role="tab"
              aria-selected={pickerMode === 'thumun'}
              className={`memorization-fields__mode-tab ${pickerMode === 'thumun' ? 'memorization-fields__mode-tab--active' : ''}`}
              onClick={() => { setPickerMode('thumun'); setQuery(''); setSurahFilter('') }}
            >
              ثمن
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pickerMode === 'surah'}
              className={`memorization-fields__mode-tab ${pickerMode === 'surah' ? 'memorization-fields__mode-tab--active' : ''}`}
              onClick={() => { setPickerMode('surah'); setQuery(''); setSurahFilter('') }}
            >
              سورة
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
                placeholder={pickerMode === 'surah' ? 'ابحث باسم السورة' : 'رقم الثمن، السورة، أو بداية الآية'}
                value={query}
                disabled={disabled}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            {pickerMode === 'thumun' && (
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
            )}
          </div>

          {resultHint && (
            <p className={`memorization-fields__result-hint meta ${(results.length || filteredSurahs.length) ? '' : 'memorization-fields__result-hint--idle'}`}>
              {resultHint}
            </p>
          )}

          {pickerMode === 'thumun' && results.length > 0 && (
            <ul className="memorization-fields__results" role="listbox" aria-label="نتائج الثمن">
              {results.map(t => {
                const active = Number(thumunId) === Number(t.id)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={`memorization-fields__result ${active ? 'memorization-fields__result--active' : ''}`}
                      onClick={() => { emitThumun(t.id); setPickerOpen(false); setQuery(''); setSurahFilter('') }}
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

          {pickerMode === 'surah' && filteredSurahs.length > 0 && (
            <ul className="memorization-fields__results" role="listbox" aria-label="قائمة السور">
              {filteredSurahs.map(name => {
                const active = surah === name
                return (
                  <li key={name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={`memorization-fields__result ${active ? 'memorization-fields__result--active' : ''}`}
                      onClick={() => { emitSurah(name); setPickerOpen(false); setQuery('') }}
                    >
                      <span className="memorization-fields__result-body">
                        <span className="memorization-fields__result-name">{name}</span>
                      </span>
                      {active && <i className="fa-solid fa-check memorization-fields__result-check" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {pickerMode === 'surah' && !query && (
            <p className="meta memorization-fields__result-hint memorization-fields__result-hint--idle">
              ابحث باسم السورة أو اختر من القائمة
            </p>
          )}
        </div>
      )}
    </div>
  )
}
