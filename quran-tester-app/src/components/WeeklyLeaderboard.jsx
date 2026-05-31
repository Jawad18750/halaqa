import { useEffect, useMemo, useState } from 'react'
import { sessions, students, guardians, getApiUrl } from '../api'
import { modeLabel, formatThumunId } from '../lib/labels.js'
import { isTelegramActive } from '../lib/guardianUi.js'
import { buildHalaqaSignature, joinMessageBlocks } from '../lib/messageContext.js'
import { useMessageSettings } from '../lib/MessageSettingsContext.jsx'
import PageHeader from './ui/PageHeader.jsx'
import EmptyState from './ui/EmptyState.jsx'
import Toast from './ui/Toast.jsx'
import GuardianMessageSheet from './ui/GuardianMessageSheet.jsx'
import LeaderboardPodium from './ui/LeaderboardPodium.jsx'
import LeaderboardRankRow from './ui/LeaderboardRankRow.jsx'

export default function WeeklyLeaderboard({ onBack, onOpenStudent }) {
  const { sheikhName, masjidName } = useMessageSettings()
  const [rows, setRows] = useState([])
  const [studentList, setStudentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [thumuns, setThumuns] = useState([])
  const [query, setQuery] = useState('')
  const [notifyingId, setNotifyingId] = useState(null)
  const [messageTargets, setMessageTargets] = useState([])
  const [messageDraft, setMessageDraft] = useState('')
  const [reportItem, setReportItem] = useState(null)
  const [includeRankInReport, setIncludeRankInReport] = useState(false)
  const [showMessageSheet, setShowMessageSheet] = useState(false)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return toDateOnly(d)
  })
  const [to, setTo] = useState(() => toDateOnly(new Date()))

  useEffect(() => {
    fetch('/quran-thumun-data.json')
      .then(r => r.json())
      .then(d => setThumuns(d.thumuns || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    students.list().then(r => setStudentList(r?.students || [])).catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await sessions.overview(from, to)
        setRows(Array.isArray(data?.sessions) ? data.sessions : [])
      } catch (e) {
        setRows([])
        setError(String(e?.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [from, to])

  async function useCurrentWeek() {
    try {
      const w = await sessions.weekly()
      const start = toDateOnly(w?.weekStartDate)
      if (!start) return
      const endDate = new Date(start)
      endDate.setDate(endDate.getDate() + 6)
      setFrom(start)
      setTo(toDateOnly(endDate))
    } catch {}
  }

  const studentById = useMemo(() => {
    const map = new Map()
    for (const s of studentList) map.set(s.id, s)
    return map
  }, [studentList])

  function openProfile(id) {
    const s = studentById.get(id)
    if (s && onOpenStudent) onOpenStudent(s, 'students')
  }

  function photoFor(id) {
    const s = studentById.get(id)
    if (!s?.photo_url) return null
    let url = s.photo_url
    if (!url.includes('?')) {
      const ver = s.updated_at ? new Date(s.updated_at).getTime() : Date.now()
      url = `${url}?v=${ver}`
    }
    const apiBase = getApiUrl()
    return url.startsWith('http') ? url : `${apiBase}${url}`
  }

  const leaderboard = useMemo(() => {
    const byStudent = new Map()
    for (const r of rows) {
      const id = r.student_id
      if (!id) continue
      if (!byStudent.has(id)) {
        byStudent.set(id, {
          id,
          student_number: Number(r.student_number || 0),
          student_name: r.student_name || '—',
          attempts: 0,
          passes: 0,
          fails: 0,
          scoreSum: 0,
          bestScore: 0,
          lastAttemptAt: null,
          modeCount: new Map(),
          thumunCount: new Map(),
        })
      }
      const agg = byStudent.get(id)
      const score = Number(r.score || 0)
      const attemptAt = parseTime(r.attempt_at || r.created_at)
      agg.attempts += 1
      agg.scoreSum += score
      agg.bestScore = Math.max(agg.bestScore, score)
      if (r.passed) agg.passes += 1
      else agg.fails += 1
      if (!agg.lastAttemptAt || attemptAt > agg.lastAttemptAt) agg.lastAttemptAt = attemptAt
      if (r.mode) agg.modeCount.set(r.mode, (agg.modeCount.get(r.mode) || 0) + 1)
      if (r.thumun_id) agg.thumunCount.set(Number(r.thumun_id), (agg.thumunCount.get(Number(r.thumun_id)) || 0) + 1)
    }

    const list = [...byStudent.values()].map(item => {
      const avgScore = item.attempts ? item.scoreSum / item.attempts : 0
      const passRate = item.attempts ? (item.passes / item.attempts) * 100 : 0
      return {
        ...item,
        avgScore,
        passRate,
        dominantMode: topMapKey(item.modeCount),
        dominantThumun: topMapKey(item.thumunCount),
      }
    })

    list.sort((a, b) => {
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore
      if (b.passRate !== a.passRate) return b.passRate - a.passRate
      if (b.attempts !== a.attempts) return b.attempts - a.attempts
      return a.student_number - b.student_number
    })

    return list.map((x, idx) => ({ ...x, rank: idx + 1 }))
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return leaderboard
    return leaderboard.filter(item =>
      String(item.student_number).includes(q) ||
      (item.student_name || '').includes(q)
    )
  }, [leaderboard, query])

  const summary = useMemo(() => ({
    students: leaderboard.length,
    attempts: rows.length,
    avgScore: average(leaderboard.map(x => x.avgScore)),
    passRate: average(leaderboard.map(x => x.passRate)),
  }), [leaderboard, rows.length])

  const topThree = useMemo(() => filtered.filter(x => x.rank <= 3), [filtered])
  const rest = useMemo(() => filtered.filter(x => x.rank > 3), [filtered])
  const showPodium = !query.trim() && topThree.length > 0

  async function notifyParent(item) {
    setNotifyingId(item.id)
    try {
      const { guardians: list } = await guardians.forStudent(item.id)
      const linked = (list || []).filter(isTelegramActive)
      if (!linked.length) {
        setToast('لا يوجد ولي أمر مربوط — أرسل دعوة Telegram أولاً')
        return
      }
      const rangeLabel = formatRangeLabel(from, to)
      setReportItem(item)
      setIncludeRankInReport(false)
      setMessageDraft(buildWeeklyReportMessage(item, from, to, { sheikhName, masjidName, includeRank: false }))
      setMessageTargets(linked)
      setShowMessageSheet(true)
    } catch (e) {
      setToast(e.message || 'تعذر تحميل أولياء الأمور')
    } finally {
      setNotifyingId(null)
    }
  }

  return (
    <div className="leaderboard-page stack">
      <PageHeader
        title="لوحة الصدارة"
        subtitle={formatRangeLabel(from, to)}
        onBack={onBack}
      />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <section className="leaderboard-panel leaderboard-panel--filter">
        <div className="leaderboard-filter">
          <div className="leaderboard-filter__dates">
            <label className="leaderboard-filter__date">
              <span className="leaderboard-filter__date-label">من</span>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </label>
            <span className="leaderboard-filter__sep" aria-hidden>—</span>
            <label className="leaderboard-filter__date">
              <span className="leaderboard-filter__date-label">إلى</span>
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn--ghost btn--sm leaderboard-filter__week" onClick={useCurrentWeek}>
            <i className="fa-solid fa-calendar-week" aria-hidden />
            هذا الأسبوع
          </button>
        </div>

        <div className="students-search leaderboard-filter__search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden />
          <input
            className="students-search__input"
            placeholder="بحث بالاسم أو الرقم"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="بحث في الترتيب"
          />
          {query && (
            <button type="button" className="students-search__clear" aria-label="مسح" onClick={() => setQuery('')}>
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
      </section>

      {!loading && leaderboard.length > 0 && (
        <section className="leaderboard-summary" aria-label="ملخص الفترة">
          <div className="leaderboard-summary__item">
            <span className="leaderboard-summary__value">{num(summary.students)}</span>
            <span className="leaderboard-summary__label">طلاب</span>
          </div>
          <div className="leaderboard-summary__item">
            <span className="leaderboard-summary__value">{num(summary.attempts)}</span>
            <span className="leaderboard-summary__label">محاولات</span>
          </div>
          <div className="leaderboard-summary__item leaderboard-summary__item--accent">
            <span className="leaderboard-summary__value">{num1(summary.avgScore)}</span>
            <span className="leaderboard-summary__label">متوسط</span>
          </div>
          <div className="leaderboard-summary__item leaderboard-summary__item--ok">
            <span className="leaderboard-summary__value">{num1(summary.passRate)}%</span>
            <span className="leaderboard-summary__label">نجاح</span>
          </div>
        </section>
      )}

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query.trim() ? 'لا نتائج' : 'لا توجد بيانات لهذه الفترة'}
          subtitle={query.trim() ? 'جرّب بحثاً مختلفاً' : 'غيّر الفترة أو انتظر اختبارات جديدة'}
        />
      ) : (
        <>
          {showPodium && (
            <LeaderboardPodium
              entries={topThree}
              onOpenStudent={openProfile}
              photoFor={photoFor}
            />
          )}

          <section className="leaderboard-list-panel">
            {showPodium && rest.length > 0 && (
              <h2 className="leaderboard-list-panel__title">باقي الترتيب</h2>
            )}
            {!showPodium && filtered.length > 0 && (
              <h2 className="leaderboard-list-panel__title">
                {query.trim() ? `${filtered.length} نتيجة` : `${filtered.length} طالب`}
              </h2>
            )}

            <div className="leaderboard-list">
              {(showPodium ? rest : filtered).map(item => (
                <LeaderboardRankRow
                  key={item.id}
                  item={item}
                  thumuns={thumuns}
                  modeLabel={modeLabel}
                  formatThumunId={formatThumunId}
                  onOpenStudent={openProfile}
                  onNotifyParent={notifyParent}
                  notifying={notifyingId}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <GuardianMessageSheet
        open={showMessageSheet}
        guardians={messageTargets}
        initialMessage={messageDraft}
        title="إرسال تقرير لولي الأمر"
        reportOptions={reportItem ? (
          <label className="leaderboard-report-option">
            <input
              type="checkbox"
              checked={includeRankInReport}
              onChange={e => {
                const next = e.target.checked
                setIncludeRankInReport(next)
                setMessageDraft(buildWeeklyReportMessage(reportItem, from, to, {
                  sheikhName,
                  masjidName,
                  includeRank: next,
                }))
              }}
            />
            <span>تضمين ترتيب الطالب في التقرير</span>
          </label>
        ) : null}
        onClose={() => { setShowMessageSheet(false); setReportItem(null) }}
        onToast={msg => setToast(msg)}
      />
    </div>
  )
}

function buildWeeklyReportMessage(item, from, to, { sheikhName, masjidName, includeRank = false } = {}) {
  const halaqaFooter = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  const fromDate = formatDateLabel(from)
  const toDate = formatDateLabel(to)
  const headerLines = [
    `الطالب: ${item.student_name}`,
    `الفترة: من ${fromDate} إلى ${toDate}`,
  ]
  if (includeRank) {
    headerLines.push(`ترتيب الطالب في الحلقة: ${item.rank}`)
  }

  return joinMessageBlocks([
    '📊 التقرير الأسبوعي لمتابعة الطالب',
    headerLines,
    [
      `عدد الاختبارات: ${num(item.attempts)}`,
      `متوسط الدرجات: ${num1(item.avgScore)}`,
      `أعلى درجة: ${num(item.bestScore)}`,
      `نسبة الاختبارات المجتازة: ${num1(item.passRate)}%`,
    ],
    'هذه رسالة متابعة من حلقة القرآن الكريم، ولا يلزم الرد عليها.',
    halaqaFooter,
    `🤲 بارك الله في ${item.student_name}، ووفقه للمراجعة والإتقان.`,
  ])
}

function formatDateLabel(value) {
  if (!value) return '—'
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      numberingSystem: 'latn',
    })
  } catch {
    return value
  }
}

function formatRangeLabel(from, to) {
  if (!from && !to) return 'اختر الفترة'
  try {
    const opts = { day: 'numeric', month: 'short' }
    const f = from ? new Date(`${from}T12:00:00`).toLocaleDateString('ar-EG-u-nu-latn', opts) : '—'
    const t = to ? new Date(`${to}T12:00:00`).toLocaleDateString('ar-EG-u-nu-latn', opts) : '—'
    return `${f} — ${t}`
  } catch {
    return `${from} — ${to}`
  }
}

function toDateOnly(v) {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
    if (v.includes('T')) return v.split('T')[0]
  }
  try {
    const d = new Date(v)
    if (!isNaN(d)) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
  } catch {}
  return ''
}

function parseTime(value) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function topMapKey(map) {
  if (!map || map.size === 0) return null
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + Number(b || 0), 0) / values.length
}

function num(n) {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('ar-EG-u-nu-latn') : String(n)
}

function num1(n) {
  const v = Number(n || 0)
  return v.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })
}
