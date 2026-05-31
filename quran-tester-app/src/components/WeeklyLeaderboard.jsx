import { useEffect, useMemo, useState } from 'react'
import { sessions, students } from '../api'
import { modeLabel, rankLabel, formatThumunId, formatLocaleDateTime } from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import StatTile from './ui/StatTile.jsx'
import EmptyState from './ui/EmptyState.jsx'

export default function WeeklyLeaderboard({ onBack, onOpenStudent }) {
  const [rows, setRows] = useState([])
  const [studentList, setStudentList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumuns, setThumuns] = useState([])
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

  function openProfile(id) {
    const s = studentList.find(x => x.id === id)
    if (s && onOpenStudent) onOpenStudent(s, 'students')
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

  return (
    <div className="stack">
      <PageHeader title="لوحة الصدارة الأسبوعية" onBack={onBack} />
      <div className="filter-bar">
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field__label">من</span>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field__label">إلى</span>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn btn--sm" onClick={useCurrentWeek}>هذا الأسبوع</button>
      </div>

      <SectionCard>
        <div className="stat-grid stat-grid--fit">
          <StatTile label="عدد الطلاب" value={num(leaderboard.length)} />
          <StatTile label="إجمالي المحاولات" value={num(rows.length)} />
          <StatTile label="متوسط عام" value={num1(average(leaderboard.map(x => x.avgScore)))} />
          <StatTile label="نسبة النجاح" value={`${num1(average(leaderboard.map(x => x.passRate)))}%`} />
        </div>
      </SectionCard>

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? <div className="loading">جاري التحميل…</div> : (
        <SectionCard>
          {leaderboard.length === 0 ? (
            <EmptyState title="لا توجد بيانات لهذه الفترة" />
          ) : (
            <>
              <div className="desktop-only table-wrapper">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>الترتيب</th>
                      <th>الطالب</th>
                      <th>المتوسط</th>
                      <th>أفضل درجة</th>
                      <th>المحاولات</th>
                      <th>النجاح</th>
                      <th>الوضع الغالب</th>
                      <th>الثمن الغالب</th>
                      <th>آخر محاولة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(item => (
                      <tr
                        key={item.id}
                        className="clickable-row"
                        onClick={() => openProfile(item.id)}
                        style={{ cursor: onOpenStudent ? 'pointer' : undefined }}
                      >
                        <td>{rankLabel(item.rank)}</td>
                        <td>{`${num(item.student_number)} — ${item.student_name}`}</td>
                        <td>{num1(item.avgScore)}</td>
                        <td>{num(item.bestScore)}</td>
                        <td>{num(item.attempts)}</td>
                        <td>{`${num(item.passes)} / ${num(item.fails)} (${num1(item.passRate)}%)`}</td>
                        <td>{modeLabel(item.dominantMode)}</td>
                        <td>{formatThumunId(item.dominantThumun, thumuns)}</td>
                        <td>{item.lastAttemptAt ? formatLocaleDateTime(new Date(item.lastAttemptAt).toISOString()) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-cards">
                {leaderboard.map(item => (
                  <div
                    key={item.id}
                    className="student-card clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openProfile(item.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(item.id) } }}
                    style={{ display: 'grid', gap: 8 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="tag">{rankLabel(item.rank)}</span>
                      <strong style={{ textAlign: 'right' }}>{`${num(item.student_number)} — ${item.student_name}`}</strong>
                    </div>
                    <div className="info-grid info-grid--fit">
                      <StatTile label="المتوسط" value={num1(item.avgScore)} />
                      <StatTile label="أفضل درجة" value={num(item.bestScore)} />
                      <StatTile label="المحاولات" value={num(item.attempts)} />
                      <StatTile label="النجاح" value={`${num1(item.passRate)}%`} />
                      <StatTile label="الوضع الغالب" value={modeLabel(item.dominantMode)} />
                      <StatTile label="الثمن الغالب" value={formatThumunId(item.dominantThumun, thumuns)} />
                      <StatTile label="آخر محاولة" value={item.lastAttemptAt ? formatLocaleDateTime(new Date(item.lastAttemptAt).toISOString()) : '—'} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}
    </div>
  )
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
