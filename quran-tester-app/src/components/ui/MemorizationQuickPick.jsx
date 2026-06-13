import { useEffect, useMemo, useState } from 'react'
import { formatMemorizationFromThumun, formatQalamLabel } from '../../lib/labels.js'

const QALAM_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

export default function MemorizationQuickPick({
  thumuns = [],
  thumunId = null,
  surah = null,
  qalamCount = 1,
  onChange,
  onQalamChange,
  disabled = false,
  idPrefix = 'mem-quick',
}) {
  const hasThumun = thumunId != null && thumunId !== ''
  const surahOnly = Boolean(surah) && !hasThumun
  const hasMemValue = hasThumun || surahOnly

  const selectedThumun = useMemo(
    () => (hasThumun ? thumuns.find(t => Number(t.id) === Number(thumunId)) : null),
    [thumuns, thumunId, hasThumun]
  )

  const resolvedSurah = surahOnly ? surah : (selectedThumun?.surah || '')
  const [open, setOpen] = useState(false)
  const [draftSurah, setDraftSurah] = useState(resolvedSurah)

  useEffect(() => {
    setDraftSurah(resolvedSurah)
  }, [resolvedSurah, thumunId, surah])

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

  const thumunsInSurah = useMemo(() => {
    if (!draftSurah) return []
    return thumuns.filter(t => t.surah === draftSurah).sort((a, b) => a.id - b.id)
  }, [thumuns, draftSurah])

  const qalamLabel = formatQalamLabel(qalamCount || 1)

  const memLabel = useMemo(() => {
    if (hasThumun) return formatMemorizationFromThumun(thumunId, thumuns)
    if (surahOnly) return `سورة ${surah} (كاملة)`
    return null
  }, [hasThumun, surahOnly, thumunId, surah, thumuns])

  const chipLabel = memLabel ? `${qalamLabel} — ${memLabel}` : qalamLabel

  function handleSurahChange(name) {
    setDraftSurah(name)
    onChange?.({ memorization_thumun_id: null, memorization_surah: null })
  }

  function handleThumunChange(id) {
    const num = Number(id)
    if (!num) return
    onChange?.({ memorization_thumun_id: num, memorization_surah: null })
    setOpen(false)
  }

  function handleSurahOnly() {
    if (!draftSurah) return
    onChange?.({ memorization_thumun_id: null, memorization_surah: draftSurah })
    setOpen(false)
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange?.({ memorization_thumun_id: null, memorization_surah: null })
    setDraftSurah('')
    setOpen(false)
  }

  function handleQalamChange(val) {
    const n = Number(val)
    if (n >= 1 && n <= 20) onQalamChange?.(n)
  }

  return (
    <div className="mem-pick">
      <button
        type="button"
        className={`mem-pick__row ${hasMemValue ? 'mem-pick__row--set' : ''} ${open ? 'mem-pick__row--open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <i className="fa-solid fa-book-quran mem-pick__icon" aria-hidden />
        <span className="mem-pick__value">{chipLabel}</span>
        {hasMemValue && (
          <button
            type="button"
            className="mem-pick__clear"
            aria-label="مسح"
            tabIndex={-1}
            onClick={handleClear}
          >
            ×
          </button>
        )}
        <i className={`fa-solid fa-chevron-down mem-pick__chevron ${open ? 'mem-pick__chevron--up' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="mem-pick__panel">
          <label className="mem-pick__field">
            <span className="mem-pick__field-label">القلم</span>
            <select
              id={`${idPrefix}-qalam`}
              className="input mem-pick__select"
              value={qalamCount || 1}
              disabled={disabled}
              onChange={e => handleQalamChange(e.target.value)}
            >
              {QALAM_OPTIONS.map(n => (
                <option key={n} value={n}>{formatQalamLabel(n)}</option>
              ))}
            </select>
          </label>

          <label className="mem-pick__field">
            <span className="mem-pick__field-label">السورة</span>
            <select
              id={`${idPrefix}-surah`}
              className="input mem-pick__select"
              value={draftSurah || ''}
              disabled={disabled}
              onChange={e => handleSurahChange(e.target.value)}
            >
              <option value="">— اختر السورة —</option>
              {surahList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          {draftSurah && (
            <>
              <label className="mem-pick__field">
                <span className="mem-pick__field-label">الثمن</span>
                <select
                  id={`${idPrefix}-thumun`}
                  className="input mem-pick__select"
                  value={hasThumun && selectedThumun?.surah === draftSurah ? String(thumunId) : ''}
                  disabled={disabled}
                  onChange={e => handleThumunChange(e.target.value)}
                >
                  <option value="">— اختر الثمن —</option>
                  {thumunsInSurah.map(t => (
                    <option key={t.id} value={t.id}>{t.id} — {t.name || '—'}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="mem-pick__surah-only"
                disabled={disabled}
                onClick={handleSurahOnly}
              >
                تسميع السورة كاملة (بدون ثمن محدد)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
