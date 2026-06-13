import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
import MemorizationQuickPick from './ui/MemorizationQuickPick.jsx'
import TestResultModal from './ui/TestResultModal.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'
import { pickNextThumun, resetPickDeck, consumeFromPickDeck } from '../lib/thumunPick.js'

const MODES = [
  { id: 'naqza', label: 'النقزة' },
  { id: 'juz', label: 'الجزء' },
  { id: 'five_hizb', label: '5 أحزاب' },
  { id: 'quarter', label: 'ربع' },
  { id: 'half', label: 'نصف' },
  { id: 'full', label: 'كامل' },
]

function PerformanceStepper({ value, min, max, onDec, onInc, disabled, compact = false, labelledBy }) {
  return (
    <div
      className={`test-performance__stepper${compact ? ' test-performance__stepper--compact' : ''}`}
      role="group"
      aria-labelledby={labelledBy}
    >
      <button
        type="button"
        className="test-performance__stepper-btn"
        aria-label="تقليل"
        disabled={disabled || value <= min}
        onClick={onDec}
      >
        −
      </button>
      <span className="test-performance__stepper-value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="test-performance__stepper-btn"
        aria-label="زيادة"
        disabled={disabled || value >= max}
        onClick={onInc}
      >
        +
      </button>
    </div>
  )
}

function testDraftKey(studentId) {
  return `halaqa.testDraft.${studentId}`
}

function readTestDraft(studentId) {
  try {
    const raw = sessionStorage.getItem(testDraftKey(studentId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft?.currentId) return null
    if (Date.now() - (draft.savedAt || 0) > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(testDraftKey(studentId))
      return null
    }
    return draft
  } catch {
    return null
  }
}

function writeTestDraft(studentId, draft) {
  try {
    sessionStorage.setItem(testDraftKey(studentId), JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch { /* storage full */ }
}

function clearTestDraft(studentId) {
  try { sessionStorage.removeItem(testDraftKey(studentId)) } catch { /* ignore */ }
}

export default function TestView({
  student,
  thumuns,
  onGoProfile,
  onTestAgain,
  onGoList,
  onHistory,
  onBack,
  onStudentUpdated,
}) {
  const initialDraft = useMemo(() => readTestDraft(student.id), [student.id])
  const [mode, setMode] = useState(() => initialDraft?.mode || 'naqza')
  const [testNaqza, setTestNaqza] = useState(() => initialDraft?.testNaqza ?? (Number(student.current_naqza) || 1))
  const [juz, setJuz] = useState(() => initialDraft?.juz || '')
  const [fiveHizb, setFiveHizb] = useState(() => initialDraft?.fiveHizb || '')
  const [quranQuarter, setQuranQuarter] = useState(() => initialDraft?.quranQuarter || '')
  const [quranHalf, setQuranHalf] = useState(() => initialDraft?.quranHalf || '')
  const [current, setCurrent] = useState(null)
  const [fatha, setFatha] = useState(() => initialDraft?.fatha ?? 0)
  const [taradud, setTaradud] = useState(() => initialDraft?.taradud ?? 0)
  const [saving, setSaving] = useState(false)
  const [naqzaSaving, setNaqzaSaving] = useState(false)
  const [error, setError] = useState('')
  const [resultModal, setResultModal] = useState(null)
  const [showManualPick, setShowManualPick] = useState(false)
  const [manualQuery, setManualQuery] = useState('')
  const [draftRestored, setDraftRestored] = useState(false)
  const [testTryNumber, setTestTryNumber] = useState(1)
  const [teacherNotes, setTeacherNotes] = useState('')
  const [memorizationThumunId, setMemorizationThumunId] = useState(student?.memorization_thumun_id ?? null)
  const [memorizationSurah, setMemorizationSurah] = useState(student?.memorization_surah ?? null)
  const [qalamCount, setQalamCount] = useState(Number(student?.qalam_count) || 1)
  const pickDeckRef = useRef([])

  const naqzaLabels = useMemo(() => buildNaqzaLabels(thumuns), [thumuns])

  useEffect(() => {
    setTestNaqza(Number(student.current_naqza) || 1)
  }, [student.id, student.current_naqza])

  useEffect(() => {
    setMemorizationThumunId(student?.memorization_thumun_id ?? null)
    setMemorizationSurah(student?.memorization_surah ?? null)
    setQalamCount(Number(student?.qalam_count) || 1)
  }, [student?.id, student?.memorization_thumun_id, student?.memorization_surah, student?.qalam_count])

  const memValue = v => (v == null || v === '' ? null : Number(v))
  const memSurahValue = v => (v == null || v === '' ? null : String(v))
  const memDirty =
    memValue(memorizationThumunId) !== memValue(student?.memorization_thumun_id)
    || memSurahValue(memorizationSurah) !== memSurahValue(student?.memorization_surah)
    || (Number(qalamCount) || 1) !== (Number(student?.qalam_count) || 1)

  function onMemorizationChange(patch) {
    if (patch.memorization_thumun_id !== undefined) setMemorizationThumunId(patch.memorization_thumun_id)
    if (patch.memorization_surah !== undefined) setMemorizationSurah(patch.memorization_surah)
  }

  function onQalamChange(newCount) {
    setQalamCount(newCount)
  }

  const filtered = useMemo(() => {
    if (mode === 'naqza') return filterThumuns(thumuns, { mode, naqza: testNaqza })
    return filterThumuns(thumuns, { mode, juz, fiveHizb, quarter: quranQuarter, half: quranHalf })
  }, [thumuns, mode, juz, fiveHizb, quranQuarter, quranHalf, testNaqza])

  const preview = useMemo(() => computeScore(fatha, taradud), [fatha, taradud])

  const filterHint = useMemo(() => {
    if (filtered.length) return null
    return emptyFilterHint(mode, { juz, fiveHizb, quarter: quranQuarter, half: quranHalf })
  }, [filtered.length, mode, juz, fiveHizb, quranQuarter, quranHalf])

  const manualOptions = useMemo(() => {
    const q = manualQuery.trim()
    let list = [...filtered].sort((a, b) => a.id - b.id)
    if (q) {
      const asNum = Number(q)
      if (!Number.isNaN(asNum) && q.match(/^\d+$/)) {
        list = list.filter(t => t.id === asNum || String(t.id).startsWith(q))
      } else {
        list = list.filter(t => (t.name || '').includes(q))
      }
    }
    return list
  }, [filtered, manualQuery])

  const apiBase = getApiUrl()
  const photoSrc = (() => {
    if (!student?.photo_url) return '/profile-placeholder.svg'
    let url = student.photo_url
    if (!url.includes('?')) url = `${url}?v=${Date.now()}`
    return url.startsWith('http') ? url : `${apiBase}${url}`
  })()

  function pickRandom() {
    if (!filtered.length) return
    const next = pickNextThumun(filtered, pickDeckRef, current?.id ?? null)
    if (next) {
      setCurrent(next)
      setError('')
    }
  }

  function selectManualThumun(thumunId) {
    const t = filtered.find(x => x.id === Number(thumunId))
    if (!t) return
    consumeFromPickDeck(pickDeckRef, t.id)
    setCurrent(t)
    setError('')
    setShowManualPick(false)
  }

  useEffect(() => {
    resetPickDeck(pickDeckRef)
  }, [mode, juz, fiveHizb, quranQuarter, quranHalf, testNaqza])

  useEffect(() => {
    if (!thumuns.length || !initialDraft?.currentId || current) return
    const t = thumuns.find(x => x.id === initialDraft.currentId)
    if (t) {
      setCurrent(t)
      setDraftRestored(true)
    }
  }, [thumuns, initialDraft, current])

  useEffect(() => {
    if (!current) return
    if (filtered.some(t => t.id === current.id)) return
    setCurrent(null)
  }, [mode, juz, fiveHizb, quranQuarter, quranHalf, testNaqza, filtered, current])

  useEffect(() => {
    if (!current) {
      clearTestDraft(student.id)
      return
    }
    writeTestDraft(student.id, {
      currentId: current.id,
      fatha,
      taradud,
      mode,
      testNaqza,
      juz,
      fiveHizb,
      quranQuarter,
      quranHalf,
    })
  }, [student.id, current, fatha, taradud, mode, testNaqza, juz, fiveHizb, quranQuarter, quranHalf])

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
    setTeacherNotes('')
  }, [])

  async function finalize() {
    if (!current) { setError('يرجى اختيار ثُمُن أولاً'); return }
    const { passed, score } = preview
    setSaving(true)
    setError('')
    try {
      if (memDirty) {
        const { student: memUpdated } = await students.update(student.id, {
          memorization_thumun_id: memorizationThumunId == null ? null : Number(memorizationThumunId),
          memorization_surah: memorizationSurah || null,
          qalam_count: Number(qalamCount) || 1,
        })
        onStudentUpdated?.(memUpdated)
      }
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
        testTryNumber,
        teacherNotes: teacherNotes.trim() || null,
      })
      const updated = res?.student ?? await refreshStudent()
      if (updated) onStudentUpdated?.(updated)
      setResultModal({
        score,
        sessionId: res?.session?.id || null,
        passed,
        naqzaAfter: passed ? (updated?.current_naqza ?? null) : student.current_naqza,
      })
      clearTestDraft(student.id)
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

      <SectionCard title="مستوى الحفظ (التسميع)">
        <MemorizationQuickPick
          thumuns={thumuns}
          thumunId={memorizationThumunId}
          surah={memorizationSurah}
          qalamCount={qalamCount}
          onChange={onMemorizationChange}
          onQalamChange={onQalamChange}
          disabled={saving}
          idPrefix="test-mem"
        />
      </SectionCard>

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
          <i className="fa-solid fa-shuffle" /> اختر ثُمُناً عشوائياً ({filtered.length})
        </button>
        <p className="meta test-pick-hint">يُعرَض كل ثمن مرة قبل التكرار — عشوائية عادلة</p>

        <button
          type="button"
          className="btn btn--ghost test-manual-toggle"
          onClick={() => setShowManualPick(v => !v)}
          disabled={!filtered.length}
        >
          <i className={`fa-solid fa-${showManualPick ? 'chevron-up' : 'list'}`} />
          {showManualPick ? 'إخفاء القائمة' : 'اختيار الثمن يدوياً'}
        </button>

        {showManualPick && (
          <div className="test-manual-pick">
            <label className="field">
              <span className="field__label">بحث برقم الثمن أو بداية الآية</span>
              <input
                className="input"
                type="search"
                inputMode="search"
                placeholder="مثال: 142 أو «الحمد»"
                value={manualQuery}
                onChange={e => setManualQuery(e.target.value)}
              />
            </label>
            <div className="test-manual-pick__list" role="listbox" aria-label="اختيار الثمن">
              {manualOptions.length === 0 ? (
                <p className="meta test-manual-pick__empty">لا نتائج — غيّر البحث أو الوضع</p>
              ) : manualOptions.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={current?.id === t.id}
                  className={`test-manual-pick__item ${current?.id === t.id ? 'test-manual-pick__item--active' : ''}`}
                  onClick={() => selectManualThumun(t.id)}
                >
                  <span className="test-manual-pick__id">#{t.id}</span>
                  <span className="test-manual-pick__name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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

      <SectionCard title="3. تسجيل الأداء" className="test-performance-card">
        <div className="test-performance">
          <div
            className={`test-performance__score ${preview.passed ? 'test-performance__score--pass' : 'test-performance__score--fail'}`}
            aria-live="polite"
          >
            <div className="test-performance__score-main">
              <span className="test-performance__score-num">{preview.score}</span>
              <div className="test-performance__score-meta">
                <Badge variant={preview.passed ? 'pass' : 'fail'}>{resultLabel(preview.passed)}</Badge>
                <span className="test-performance__grade">{gradeLabel(preview.score)}</span>
              </div>
            </div>
            <p className="test-performance__score-hint meta">معاينة مباشرة — تتغيّر مع العدادات</p>
          </div>

          <div className="test-performance__metrics">
            <div className="test-performance__metric">
              <div className="test-performance__metric-head">
                <span className="test-performance__metric-label" id="test-metric-fatha">الفتحة</span>
                <span className={`test-performance__metric-hint ${fatha >= 4 ? 'test-performance__metric-hint--warn' : ''}`}>
                  {fatha >= 4 ? 'فشل' : '4+ = فشل'}
                </span>
              </div>
              <PerformanceStepper
                value={fatha}
                min={0}
                max={10}
                disabled={saving}
                labelledBy="test-metric-fatha"
                onDec={() => setFatha(Math.max(0, fatha - 1))}
                onInc={() => setFatha(Math.min(10, fatha + 1))}
              />
            </div>

            <div className="test-performance__metric">
              <div className="test-performance__metric-head">
                <span className="test-performance__metric-label" id="test-metric-taradud">التردد</span>
                <span className="test-performance__metric-hint">تأثير على الدرجة</span>
              </div>
              <PerformanceStepper
                value={taradud}
                min={0}
                max={99}
                disabled={saving}
                labelledBy="test-metric-taradud"
                onDec={() => setTaradud(Math.max(0, taradud - 1))}
                onInc={() => setTaradud(taradud + 1)}
              />
            </div>
          </div>

          <div className="test-performance__qalam">
            <div className="test-performance__qalam-copy">
              <span className="test-performance__qalam-label" id="test-metric-qalam">المحاولة</span>
              <span className="test-performance__qalam-sub meta">
                رقم المحاولة في هذا الاختبار
              </span>
            </div>
            <PerformanceStepper
              value={testTryNumber}
              min={1}
              max={9}
              compact
              disabled={saving}
              labelledBy="test-metric-qalam"
              onDec={() => setTestTryNumber(n => Math.max(1, n - 1))}
              onInc={() => setTestTryNumber(n => Math.min(9, n + 1))}
            />
          </div>

          <details className="test-performance__notes" open={Boolean(teacherNotes)}>
            <summary className="test-performance__notes-summary">
              <span className="test-performance__notes-summary-text">
                ملاحظات للولي الأمر
                <span className="test-performance__notes-badge">اختياري</span>
              </span>
            </summary>
            <p className="test-performance__notes-hint meta">تظهر في رسالة Telegram لولي الأمر فقط عند كتابتها</p>
            <textarea
              className="input test-performance__notes-input"
              rows={3}
              maxLength={500}
              placeholder="مثال: يحتاج مراجعة سورة البقرة قبل الاختبار القادم"
              value={teacherNotes}
              disabled={saving}
              onChange={e => setTeacherNotes(e.target.value)}
            />
          </details>

          {draftRestored && (
            <div className="alert alert--info test-performance__alert">
              <i className="fa-solid fa-rotate-left" aria-hidden /> تم استرجاع مسودة الاختبار السابقة — يمكنك إعادة الحفظ مباشرة.
            </div>
          )}

          {error && (
            <div className="alert alert--error test-save-error test-performance__alert">
              <p>{error}</p>
              {current && (
                <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={finalize}>
                  {saving ? 'جاري الحفظ…' : 'إعادة المحاولة'}
                </button>
              )}
            </div>
          )}
        </div>
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
