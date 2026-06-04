import { useMemo, useState } from 'react'
import { formatMemorizationFromThumun } from '../../lib/labels.js'

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase()
}

export default function MemorizationFields({
  thumuns = [],
  value,
  onChange,
  disabled = false,
  idPrefix = 'mem',
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const bySurah = useMemo(() => {
    const map = new Map()
    for (const t of thumuns) {
      const key = t.surah || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    }
    for (const list of map.values()) list.sort((a, b) => a.id - b.id)
    return [...map.entries()].sort((a, b) => {
      const aMin = a[1][0]?.id ?? 0
      const bMin = b[1][0]?.id ?? 0
      return aMin - bMin
    })
  }, [thumuns])

  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    if (!q) return bySurah
    const out = []
    for (const [surah, list] of bySurah) {
      const hits = list.filter(t => {
        const idStr = String(t.id)
        const name = String(t.name || '').toLowerCase()
        const surahL = String(surah).toLowerCase()
        return idStr.includes(q) || name.includes(q) || surahL.includes(q)
      })
      if (hits.length) out.push([surah, hits])
    }
    return out
  }, [bySurah, query])

  const selectedLabel = formatMemorizationFromThumun(value, thumuns)
  const listId = `${idPrefix}-list`

  function pick(id) {
    onChange?.(id == null ? null : Number(id))
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="memorization-fields">
      <label className="field">
        <span className="field__label">مستوى الحفظ (التسميع)</span>
        <p className="field__hint meta">موضع التسميع — منفصل عن النقزة والاختبار</p>
        {value != null && value !== '' && (
          <p className="memorization-fields__current">{selectedLabel || `ثمن ${value}`}</p>
        )}
        <input
          id={`${idPrefix}-search`}
          className="input"
          type="search"
          inputMode="search"
          placeholder="بحث برقم الثمن أو السورة أو بداية الآية"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
      </label>
      {open && (
        <div className="memorization-fields__list" id={listId} role="listbox" aria-label="اختيار مستوى الحفظ">
          <button
            type="button"
            className="memorization-fields__clear btn btn--ghost btn--sm"
            disabled={disabled || value == null}
            onClick={() => pick(null)}
          >
            مسح الاختيار
          </button>
          {filtered.length === 0 ? (
            <p className="meta memorization-fields__empty">لا نتائج — غيّر البحث</p>
          ) : filtered.map(([surah, list]) => (
            <div key={surah} className="memorization-fields__group">
              <div className="memorization-fields__group-title">{surah}</div>
              {list.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={Number(value) === Number(t.id)}
                  disabled={disabled}
                  className={`test-manual-pick__item ${Number(value) === Number(t.id) ? 'test-manual-pick__item--active' : ''}`}
                  onClick={() => pick(t.id)}
                >
                  <span className="test-manual-pick__id">#{t.id}</span>
                  <span className="test-manual-pick__name">{t.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
