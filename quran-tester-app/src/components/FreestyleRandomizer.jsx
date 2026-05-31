import { useEffect, useMemo, useState } from 'react'
import {
  QUARTER_LABELS,
  HALF_LABELS,
  buildNaqzaLabels,
  filterThumuns,
  formatJuz,
  naqzaName,
  fiveHizbLabel,
  emptyFilterHint,
} from '../lib/labels.js'
import StatTile from './ui/StatTile.jsx'
import SectionCard from './ui/SectionCard.jsx'

export default function FreestyleRandomizer({ thumuns, loading, onSignIn }) {
  const [mode, setMode] = useState('naqza')
  const [naqza, setNaqza] = useState(1)
  const [juz, setJuz] = useState('')
  const [fiveHizb, setFiveHizb] = useState('')
  const [quarter, setQuarter] = useState('')
  const [half, setHalf] = useState('')
  const [current, setCurrent] = useState(null)
  const [highlight, setHighlight] = useState(false)

  const naqzaLabels = useMemo(() => buildNaqzaLabels(thumuns), [thumuns])

  const filtered = useMemo(
    () => filterThumuns(thumuns, { mode, naqza, juz, fiveHizb: fiveHizb, quarter, half }),
    [thumuns, mode, naqza, juz, fiveHizb, quarter, half]
  )

  const filterHint = useMemo(() => {
    if (filtered.length) return null
    return emptyFilterHint(mode, { juz, fiveHizb, quarter, half })
  }, [filtered.length, mode, juz, fiveHizb, quarter, half])

  useEffect(() => { setCurrent(null) }, [mode, naqza, juz, fiveHizb, quarter, half, thumuns])

  function pickRandom() {
    if (!filtered.length) return
    const pool = current ? filtered.filter(t => t.id !== current.id) : filtered
    const base = pool.length ? pool : filtered
    setCurrent(base[Math.floor(Math.random() * base.length)])
    setHighlight(true)
    setTimeout(() => setHighlight(false), 900)
  }

  return (
    <div className="free-mode stack">
      {onSignIn && (
        <div className="guest-banner">
          أنت في الوضع الحر كزائر.
          <button type="button" onClick={onSignIn}>سجّل الدخول</button>
          لتسجيل الطلاب والمحاولات.
        </div>
      )}

      <SectionCard title="الوضع الحر">
        <div className="controls">
          <label className="label-stack-center field" aria-label="الوضع">
            <span className="field__label">الوضع</span>
            <select
              value={mode}
              onChange={e => {
                setMode(e.target.value)
                setJuz('')
                setFiveHizb('')
                setQuarter('')
                setHalf('')
                setCurrent(null)
              }}
              className="input select-center"
              style={{ maxWidth: 280 }}
            >
              <option value="naqza">حسب النقزة</option>
              <option value="juz">حسب الجزء</option>
              <option value="five_hizb">خمسة أحزاب</option>
              <option value="quarter">ربع القرآن</option>
              <option value="half">نصف القرآن</option>
              <option value="full">القرآن كامل</option>
            </select>
          </label>

          {mode === 'naqza' && (
            <label className="label-stack-center field">
              <span className="field__label">النقزة</span>
              <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} className="input select-center" style={{ maxWidth: 300 }}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{`${n} - ${naqzaLabels[n - 1]}`}</option>
                ))}
              </select>
            </label>
          )}

          {mode === 'juz' && (
            <label className="label-stack-center field">
              <span className="field__label">الجزء</span>
              <select value={juz} onChange={e => setJuz(e.target.value)} className="input select-center" style={{ maxWidth: 240 }}>
                <option value="">—</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{formatJuz(n)}</option>
                ))}
              </select>
            </label>
          )}

          {mode === 'five_hizb' && (
            <label className="label-stack-center field">
              <span className="field__label">المجموعة</span>
              <select value={fiveHizb} onChange={e => setFiveHizb(e.target.value)} className="input select-center" style={{ maxWidth: 240 }}>
                <option value="">—</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{fiveHizbLabel(n)}</option>
                ))}
              </select>
            </label>
          )}

          {mode === 'quarter' && (
            <label className="label-stack-center field">
              <span className="field__label">الربع</span>
              <select value={quarter} onChange={e => setQuarter(e.target.value)} className="input select-center" style={{ maxWidth: 240 }}>
                <option value="">—</option>
                {QUARTER_LABELS.map((lbl, idx) => (
                  <option key={idx + 1} value={idx + 1}>{lbl}</option>
                ))}
              </select>
            </label>
          )}

          {mode === 'half' && (
            <label className="label-stack-center field">
              <span className="field__label">النصف</span>
              <select value={half} onChange={e => setHalf(e.target.value)} className="input select-center" style={{ maxWidth: 240 }}>
                <option value="">—</option>
                {HALF_LABELS.map((lbl, idx) => (
                  <option key={idx + 1} value={idx + 1}>{lbl}</option>
                ))}
              </select>
            </label>
          )}

          <button type="button" className="btn btn--primary" onClick={pickRandom} disabled={loading || !filtered.length}>
            <i className="fa-solid fa-shuffle" /> اختر ثُمُناً عشوائياً
          </button>
        </div>

        {filterHint ? (
          <p className="alert alert--error" style={{ textAlign: 'center', marginTop: 8 }}>{filterHint}</p>
        ) : (
          <p className="meta" style={{ textAlign: 'center' }}>
            {loading ? 'جاري التحميل…' : (filtered.length ? `عدد الأثمان المتاحة: ${filtered.length.toLocaleString('ar-EG-u-nu-latn')}` : 'لا توجد أثمان متاحة')}
          </p>
        )}
      </SectionCard>

      {current && (
        <SectionCard>
          <div className={`card appear ${highlight ? 'pulse-outline' : ''}`}>
            <div className="thumun-hero">
              <div className="thumun-hero__id">الثُمُن رقم {current.id}</div>
              <div className="thumun-hero__phrase">{current.name || '—'}</div>
            </div>
            <div className="cluster" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button type="button" className="btn" onClick={pickRandom}><i className="fa-solid fa-shuffle" /> اختيار جديد</button>
            </div>
            <div className="info-grid info-grid--fit" style={{ marginTop: 16 }}>
              <StatTile label="السورة" value={current.surah ? `${current.surah}${current.surahNumber ? ` (${current.surahNumber})` : ''}` : '—'} />
              <StatTile label="الحزب" value={current.hizb ?? '—'} />
              <StatTile label="الربع" value={current.quarter ?? '—'} />
              <StatTile label="الجزء" value={current.juz ? formatJuz(current.juz) : '—'} />
              <StatTile label="النقزة" value={current.naqza ? `${current.naqza} - ${naqzaName(current.naqza, thumuns)}` : '—'} />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
