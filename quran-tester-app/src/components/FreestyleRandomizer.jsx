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
import PageHeader from './ui/PageHeader.jsx'

export default function FreestyleRandomizer({ thumuns, loading, theme = 'light', onSignIn, onBack }) {
  const isGuest = Boolean(onSignIn)
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

  function resetModeFilters() {
    setJuz('')
    setFiveHizb('')
    setQuarter('')
    setHalf('')
    setCurrent(null)
  }

  function pickRandom() {
    if (!filtered.length) return
    const pool = current ? filtered.filter(t => t.id !== current.id) : filtered
    const base = pool.length ? pool : filtered
    setCurrent(base[Math.floor(Math.random() * base.length)])
    setHighlight(true)
    setTimeout(() => setHighlight(false), 900)
  }

  const pickerFields = (
    <>
      <label className="field freestyle-field">
        <span className="field__label">الوضع</span>
        <select
          value={mode}
          onChange={e => {
            setMode(e.target.value)
            resetModeFilters()
          }}
          className="input freestyle-field__input"
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
        <label className="field freestyle-field">
          <span className="field__label">النقزة</span>
          <select value={naqza} onChange={e => { setNaqza(Number(e.target.value)); setJuz('') }} className="input freestyle-field__input">
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{`${n} - ${naqzaLabels[n - 1]}`}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'juz' && (
        <label className="field freestyle-field">
          <span className="field__label">الجزء</span>
          <select value={juz} onChange={e => setJuz(e.target.value)} className="input freestyle-field__input">
            <option value="">—</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{formatJuz(n)}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'five_hizb' && (
        <label className="field freestyle-field">
          <span className="field__label">المجموعة</span>
          <select value={fiveHizb} onChange={e => setFiveHizb(e.target.value)} className="input freestyle-field__input">
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{fiveHizbLabel(n)}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'quarter' && (
        <label className="field freestyle-field">
          <span className="field__label">الربع</span>
          <select value={quarter} onChange={e => setQuarter(e.target.value)} className="input freestyle-field__input">
            <option value="">—</option>
            {QUARTER_LABELS.map((lbl, idx) => (
              <option key={idx + 1} value={idx + 1}>{lbl}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'half' && (
        <label className="field freestyle-field">
          <span className="field__label">النصف</span>
          <select value={half} onChange={e => setHalf(e.target.value)} className="input freestyle-field__input">
            <option value="">—</option>
            {HALF_LABELS.map((lbl, idx) => (
              <option key={idx + 1} value={idx + 1}>{lbl}</option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  const statusLine = filterHint ? (
    <p className="freestyle-picker__alert">{filterHint}</p>
  ) : (
    <p className="freestyle-picker__meta">
      {loading ? 'جاري التحميل…' : (filtered.length ? `${filtered.length.toLocaleString('ar-EG-u-nu-latn')} ثُمُن متاح` : 'لا توجد أثمان متاحة')}
    </p>
  )

  const resultBlock = current && (
    <SectionCard className="freestyle-result appear">
      <div className={`freestyle-result__card ${highlight ? 'pulse-outline' : ''}`}>
        <div className="freestyle-result__badge">الثُمُن رقم {current.id}</div>
        <p className="freestyle-result__phrase">{current.name || '—'}</p>
        <button type="button" className="btn btn--ghost btn--sm freestyle-result__again" onClick={pickRandom}>
          <i className="fa-solid fa-shuffle" /> اختيار جديد
        </button>
        <div className="info-grid info-grid--fit freestyle-result__stats">
          <StatTile label="السورة" value={current.surah ? `${current.surah}${current.surahNumber ? ` (${current.surahNumber})` : ''}` : '—'} />
          <StatTile label="الحزب" value={current.hizb ?? '—'} />
          <StatTile label="الربع" value={current.quarter ?? '—'} />
          <StatTile label="الجزء" value={current.juz ? formatJuz(current.juz) : '—'} />
          <StatTile label="النقزة" value={current.naqza ? `${current.naqza} - ${naqzaName(current.naqza, thumuns)}` : '—'} />
        </div>
      </div>
    </SectionCard>
  )

  const pickerCard = (
    <SectionCard className="freestyle-picker appear">
      <div className="freestyle-picker__head">
        <div className="freestyle-picker__head-text">
          <h2 className="freestyle-picker__title">اختيار الثُمُن</h2>
          <p className="freestyle-picker__lead">حدّد النطاق ثم اضغط الزر للاختيار العشوائي</p>
        </div>
        {!loading && filtered.length > 0 && (
          <span className="freestyle-picker__count" aria-label={`${filtered.length} ثُمُن متاح`}>
            {filtered.length.toLocaleString('ar-EG-u-nu-latn')}
          </span>
        )}
      </div>
      <div className="freestyle-picker__fields">{pickerFields}</div>
      <button
        type="button"
        className="btn btn--primary freestyle-picker__shuffle"
        onClick={pickRandom}
        disabled={loading || !filtered.length}
      >
        <i className="fa-solid fa-shuffle" aria-hidden="true" />
        اختر ثُمناً عشوائياً
      </button>
      {statusLine}
    </SectionCard>
  )

  if (isGuest) {
    return (
      <div className="guest-home">
        <section className="guest-hero appear">
          <img
            className="guest-hero__logo"
            src={theme === 'dark' ? '/quran-white.png' : '/quran.png'}
            alt=""
            width={56}
            height={56}
          />
          <h1 className="guest-hero__title">اختبار الحلقة</h1>
          <p className="guest-hero__lead">اختر ثُمناً عشوائياً للتدريب — الوضع الحر متاح بدون حساب</p>
          <button type="button" className="btn btn--primary guest-hero__signin" onClick={onSignIn}>
            <i className="fa-solid fa-right-to-bracket" /> سجّل الدخول
          </button>
          <p className="guest-hero__hint">لإدارة الطلاب وحفظ المحاولات والتقارير</p>
        </section>

        {pickerCard}

        {resultBlock}
      </div>
    )
  }

  return (
    <div className="free-mode">
      {onBack && (
        <PageHeader
          title="الوضع الحر"
          subtitle="اختر ثُمناً عشوائياً للتدريب"
          onBack={onBack}
        />
      )}
      {pickerCard}
      {resultBlock}
    </div>
  )
}
