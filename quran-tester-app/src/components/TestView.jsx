import { useEffect, useMemo, useState, useCallback } from 'react'
import { sessions, students, getApiUrl } from '../api'
import {
  QUARTER_LABELS,
  HALF_LABELS,
  buildNaqzaLabels,
  formatNaqza,
  formatJuz,
  fiveHizbLabel,
  filterThumuns,
  computeScore,
  emptyFilterHint,
  resultLabel,
  gradeLabel,
} from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import StatTile from './ui/StatTile.jsx'
import SectionCard from './ui/SectionCard.jsx'
import Badge from './ui/Badge.jsx'
import TestResultModal from './ui/TestResultModal.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'

const MODES = [
  { id: 'naqza', label: 'النقزة' },
  { id: 'juz', label: 'الجزء' },
  { id: 'five_hizb', label: '5 أحزاب' },
  { id: 'quarter', label: 'ربع' },
  { id: 'half', label: 'نصف' },
  { id: 'full', label: 'كامل' },
]

export default function TestView({ student, thumuns, onGoProfile, onTestAgain, onGoList, onHistory, onBack, onStudentUpdated }) {
  const [mode, setMode] = useState('naqza')
  const [testNaqza, setTestNaqza] = useState(Number(student.current_naqza) || 1)
  const [juz, setJuz] = useState('')
  const [fiveHizb, setFiveHizb] = useState('')
  const [quranQuarter, setQuranQuarter] = useState('')
  const [quranHalf, setQuranHalf] = useState('')
  const [current, setCurrent] = useState(null)
  const [fatha, setFatha] = useState(0)
  const [taradud, setTaradud] = useState(0)
  const [saving, setSaving] = useState(false)
  const [naqzaSaving, setNaqzaSaving] = useState(false)
  const [error, setError] = useState('')
  const [resultModal, setResultModal] = useState(null)

  const naqzaLabels = useMemo(() => buildNaqzaLabels(thumuns), [thumuns])

  useEffect(() => {
    setTestNaqza(Number(student.current_naqza) || 1)
  }, [student.id, student.current_naqza])

  const filtered = useMemo(() => {
    if (mode === 'naqza') return filterThumuns(thumuns, { mode, naqza: testNaqza })
    return filterThumuns(thumuns, { mode, juz, fiveHizb, quarter: quranQuarter, half: quranHalf })
  }, [thumuns, mode, juz, fiveHizb, quranQuarter, quranHalf, testNaqza])

  const preview = useMemo(() => computeScore(fatha, taradud), [fatha, taradud])

  const filterHint = useMemo(() => {
    if (filtered.length) return null
    return emptyFilterHint(mode, { juz, fiveHizb, quarter: quranQuarter, half: quranHalf })
  }, [filtered.length, mode, juz, fiveHizb, quranQuarter, quranHalf])

  const apiBase = getApiUrl()
  const photoSrc = (() => {
    if (!student?.photo_url) return '/profile-placeholder.svg'
    let url = student.photo_url
    if (!url.includes('?')) url = `${url}?v=${Date.now()}`
    return url.startsWith('http') ? url : `${apiBase}${url}`
  })()

  function pickRandom() {
    if (!filtered.length) return
    const pool = current ? filtered.filter(t => t.id !== current.id) : filtered
    const base = pool.length ? pool : filtered
    setCurrent(base[Math.floor(Math.random() * base.length)])
  }

  useEffect(() => { setCurrent(null) }, [mode, juz, fiveHizb, quranQuarter, quranHalf, testNaqza])

  const refreshStudent = useCallback(async () => {
    const { students: list } = await students.list()
    const updated = list?.find(s => s.id === student.id)
    if (updated) {
      onStudentUpdated?.(updated)
      return updated
    }
    return null
  }, [student.id, onStudentUpdated])

  async function handleNaqzaChange(nextRaw) {
    const next = Number(nextRaw)
    if (!next || next === testNaqza) return
    setTestNaqza(next)
    setNaqzaSaving(true)
    setError('')
    try {
      const { student: updated } = await students.update(student.id, { current_naqza: next })
      onStudentUpdated?.(updated)
    } catch (e) {
      setTestNaqza(Number(student.current_naqza) || 1)
      setError(e?.message || 'تعذر تحديث النقزة')
    } finally {
      setNaqzaSaving(false)
    }
  }

  const resetCounters = useCallback(() => {
    setFatha(0)
    setTaradud(0)
    setCurrent(null)
  }, [])

  async function finalize() {
    if (!current) { setError('يرجى اختيار ثُمُن أولاً'); return }
    const { passed, score } = preview
    setSaving(true)
    setError('')
    try {
      const res = await sessions.create({
        studentId: student.id,
        mode,
        selectedNaqza: mode === 'naqza' ? testNaqza : student.current_naqza,
        selectedJuz: mode === 'juz' ? Number(juz) : null,
        selectedFiveHizb: mode === 'five_hizb' ? Number(fiveHizb) || null : null,
        selectedQuranQuarter: mode === 'quarter' ? Number(quranQuarter) || null : null,
        selectedQuranHalf: mode === 'half' ? Number(quranHalf) || null : null,
        thumunId: current.id,
        fathaPrompts: fatha,
        taradudCount: taradud,
        passed,
        score,
      })
      const updated = res?.student ?? await refreshStudent()
      if (updated) onStudentUpdated?.(updated)
      setResultModal({
        score,
        passed,
        naqzaAfter: passed ? (updated?.current_naqza ?? null) : student.current_naqza,
      })
      resetCounters()
    } catch (e) {
      setError(e?.message || 'تعذر حفظ المحاولة')
    } finally {
      setSaving(false)
    }
  }

  async function handleResult() {
    const msg = `تسجيل نتيجة ${student.name}:\n${resultLabel(preview.passed)} — ${preview.score} (${gradeLabel(preview.score)})`
    const ok = await confirmDialog('تأكيد النتيجة', msg)
    if (!ok) return
    await finalize()
  }

  return (
    <div className="test-view stack--test-page">
      <PageHeader
        title="اختبار"
        onBack={onBack}
        actions={onHistory && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onHistory} aria-label="السجل">
            <i className="fa-solid fa-clock-rotate-left" />
          </button>
        )}
      />

      <div className="test-student-bar">
        <img className="test-student-bar__avatar" src={photoSrc} alt="" width={48} height={48} onError={(e) => { e.currentTarget.src = '/profile-placeholder.svg' }} />
        <div className="test-student-bar__body">
          <p className="test-student-bar__name">{student.name}</p>
          <p className="test-student-bar__meta">#{student.number}</p>
          <label className="test-student-bar__naqza-field">
            <span className="test-student-bar__naqza-label">النقزة الحالية</span>
            <select
              className="input test-student-bar__naqza-select"
              value={testNaqza}
              disabled={naqzaSaving || saving}
              onChange={e => handleNaqzaChange(e.target.value)}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{formatNaqza(n, thumuns, naqzaLabels)}</option>
              ))}
            </select>
          </label>
          <p className="test-student-bar__hint meta">عند النجاح تتقدّم النقزة الحالية تلقائياً (+1) — في كل الأوضاع</p>
        </div>
      </div>

      <SectionCard title="1. اختيار الوضع">
        <div className="mode-chips" role="tablist" aria-label="وضع الاختبار">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`mode-chip ${mode === m.id ? 'mode-chip--active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="test-setup__filters">
          {mode === 'naqza' && (
            <p className="meta test-setup__naqza-note">
              اختبار من نقزة {formatNaqza(testNaqza, thumuns, naqzaLabels)} — {filtered.length} ثُمُن متاح
            </p>
          )}
          {mode === 'juz' && (
            <label className="field">
              <span className="field__label">الجزء</span>
              <select className="input" value={juz} onChange={e => setJuz(e.target.value)}>
                <option value="">اختر الجزء</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{formatJuz(n)}</option>
                ))}
              </select>
            </label>
          )}
          {mode === 'five_hizb' && (
            <label className="field">
              <span className="field__label">المجموعة</span>
              <select className="input" value={fiveHizb} onChange={e => setFiveHizb(e.target.value)}>
                <option value="">اختر المجموعة</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{fiveHizbLabel(n)}</option>
                ))}
              </select>
            </label>
          )}
          {mode === 'quarter' && (
            <label className="field">
              <span className="field__label">الربع</span>
              <select className="input" value={quranQuarter} onChange={e => setQuranQuarter(e.target.value)}>
                <option value="">اختر الربع</option>
                {QUARTER_LABELS.map((lbl, idx) => <option key={idx + 1} value={idx + 1}>{lbl}</option>)}
              </select>
            </label>
          )}
          {mode === 'half' && (
            <label className="field">
              <span className="field__label">النصف</span>
              <select className="input" value={quranHalf} onChange={e => setQuranHalf(e.target.value)}>
                <option value="">اختر النصف</option>
                {HALF_LABELS.map((lbl, idx) => <option key={idx + 1} value={idx + 1}>{lbl}</option>)}
              </select>
            </label>
          )}
        </div>

        <button type="button" className="btn btn--primary test-pick-btn" onClick={pickRandom} disabled={!filtered.length}>
          <i className="fa-solid fa-shuffle" /> اختر ثُمُناً ({filtered.length})
        </button>

        {filterHint && <p className="alert alert--error" style={{ marginTop: 8, textAlign: 'center' }}>{filterHint}</p>}
      </SectionCard>

      {current && (
        <SectionCard title="2. الثُمُن المختار">
          <div className="thumun-hero thumun-hero--test">
            <div className="thumun-hero__id">#{current.id}</div>
            <div className="thumun-hero__phrase">{current.name}</div>
          </div>
          <div className="info-grid info-grid--fit">
            <StatTile label="السورة" value={current.surah || '—'} />
            <StatTile label="الحزب" value={current.hizb ?? '—'} />
            <StatTile label="الجزء" value={formatJuz(current.juz)} />
            <StatTile label="النقزة" value={formatNaqza(current.naqza, thumuns)} />
          </div>
          <button type="button" className="btn btn--ghost" style={{ width: '100%', marginTop: 12 }} onClick={pickRandom}>
            <i className="fa-solid fa-shuffle" /> ثُمُن آخر
          </button>
        </SectionCard>
      )}

      <SectionCard title="3. تسجيل الأداء">
        <div className="counter-row">
          <div className="counter-block counter-block--touch">
            <div className="info-label">الفتحة</div>
            <div className="counter-block__value">{fatha}</div>
            <p className="hint">4+ = فشل</p>
            <div className="counter-block__actions">
              <button type="button" className="btn" aria-label="تقليل" onClick={() => setFatha(Math.max(0, fatha - 1))}>−</button>
              <button type="button" className="btn" aria-label="زيادة" onClick={() => setFatha(Math.min(10, fatha + 1))}>+</button>
            </div>
          </div>
          <div className="counter-block counter-block--touch">
            <div className="info-label">التردد</div>
            <div className="counter-block__value">{taradud}</div>
            <div className="counter-block__actions">
              <button type="button" className="btn" aria-label="تقليل" onClick={() => setTaradud(Math.max(0, taradud - 1))}>−</button>
              <button type="button" className="btn" aria-label="زيادة" onClick={() => setTaradud(taradud + 1)}>+</button>
            </div>
          </div>
        </div>

        <div className="score-preview desktop-only">
          <div className="meta">معاينة الدرجة</div>
          <div className="score-preview__value">{preview.score}</div>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Badge variant={preview.passed ? 'pass' : 'fail'}>{resultLabel(preview.passed)}</Badge>
            <span className="meta">{gradeLabel(preview.score)}</span>
          </div>
        </div>

        {error && <div className="alert alert--error" style={{ marginTop: 12 }}>{error}</div>}
      </SectionCard>

      <div className="test-sticky-bar test-sticky-bar--enhanced">
        <div className="test-sticky-bar__preview">
          <span className="test-sticky-bar__score">{preview.score}</span>
          <Badge variant={preview.passed ? 'pass' : 'fail'}>{resultLabel(preview.passed)}</Badge>
        </div>
        <button type="button" className="btn btn--primary" disabled={!current || saving} onClick={handleResult}>
          {saving ? 'جاري الحفظ…' : 'تسجيل النتيجة'}
        </button>
      </div>

      <TestResultModal
        open={Boolean(resultModal)}
        studentName={student.name}
        score={resultModal?.score}
        passed={resultModal?.passed}
        naqzaAfter={resultModal?.naqzaAfter}
        naqzaLabels={naqzaLabels}
        thumuns={thumuns}
        onProfile={() => { setResultModal(null); onGoProfile?.() }}
        onTestAgain={() => { setResultModal(null); onTestAgain?.() }}
        onList={() => { setResultModal(null); onGoList?.() }}
      />
    </div>
  )
}
