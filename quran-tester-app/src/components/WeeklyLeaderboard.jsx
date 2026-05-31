import { useEffect, useMemo, useState } from 'react'
import { sessions } from '../api'

export default function WeeklyLeaderboard({ onBack }) {
  const [rows, setRows] = useState([])
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
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>

      <h2 style={{ textAlign: 'center', marginTop: 0 }}>لوحة الصدارة الأسبوعية</h2>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <label className="info-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          من:
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="info-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          إلى:
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <button className="btn" onClick={useCurrentWeek}>هذا الأسبوع</button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="info-grid info-grid--fit">
          <Info label="عدد الطلاب في الصدارة" value={num(leaderboard.length)} />
          <Info label="إجمالي المحاولات" value={num(rows.length)} />
          <Info label="متوسط عام" value={num1(average(leaderboard.map(x => x.avgScore)))} />
          <Info label="نسبة النجاح العامة" value={`${num1(average(leaderboard.map(x => x.passRate)))}%`} />
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ marginTop: 12 }}>جاري التحميل…</div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          {leaderboard.length === 0 ? (
            <div>لا توجد بيانات لهذه الفترة.</div>
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
                      <tr key={item.id}>
                        <td>{rankLabel(item.rank)}</td>
                        <td>{`${num(item.student_number)} — ${item.student_name}`}</td>
                        <td>{num1(item.avgScore)}</td>
                        <td>{num(item.bestScore)}</td>
                        <td>{num(item.attempts)}</td>
                        <td>{`${num(item.passes)} / ${num(item.fails)} (${num1(item.passRate)}%)`}</td>
                        <td>{modeLabel(item.dominantMode)}</td>
                        <td>{formatThumun(item.dominantThumun, thumuns)}</td>
                        <td>{item.lastAttemptAt ? new Date(item.lastAttemptAt).toLocaleString('ar-EG-u-nu-latn') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-cards">
                {leaderboard.map(item => (
                  <div key={item.id} className="student-card" style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="tag">{rankLabel(item.rank)}</span>
                      <strong style={{ textAlign: 'right' }}>{`${num(item.student_number)} — ${item.student_name}`}</strong>
                    </div>
                    <div className="info-grid info-grid--fit">
                      <Info label="المتوسط" value={num1(item.avgScore)} />
                      <Info label="أفضل درجة" value={num(item.bestScore)} />
                      <Info label="المحاولات" value={num(item.attempts)} />
                      <Info label="النجاح" value={`${num1(item.passRate)}%`} />
                      <Info label="الوضع الغالب" value={modeLabel(item.dominantMode)} />
                      <Info label="الثمن الغالب" value={formatThumun(item.dominantThumun, thumuns)} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="info">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
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

function rankLabel(rank) {
  if (rank === 1) return '🥇 المركز 1'
  if (rank === 2) return '🥈 المركز 2'
  if (rank === 3) return '🥉 المركز 3'
  return `المركز ${num(rank)}`
}

function modeLabel(mode) {
  switch (mode) {
    case 'naqza': return 'النقزة'
    case 'juz': return 'الجزء'
    case 'five_hizb': return 'خمسة أحزاب'
    case 'quarter': return 'ربع القرآن'
    case 'half': return 'نصف القرآن'
    case 'full': return 'القرآن كامل'
    default: return mode ? String(mode) : '—'
  }
}

function formatThumun(id, thumuns) {
  const numId = Number(id || 0)
  if (!numId) return '—'
  const t = thumuns.find(x => x.id === numId)
  if (!t) return num(numId)
  return `${num(t.id)} - ${t.name}`
}
