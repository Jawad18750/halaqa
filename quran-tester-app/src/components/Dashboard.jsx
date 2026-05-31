import { useEffect, useMemo, useState, useCallback, Fragment } from 'react'
import { sessions, students } from '../api'
import { formatNaqza } from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import StatTile from './ui/StatTile.jsx'
import SectionCard from './ui/SectionCard.jsx'
import EmptyState from './ui/EmptyState.jsx'

const AT_RISK_RECENT_LIMIT = 5
const AT_RISK_MIN_AVG = 60
const AT_RISK_MIN_FAIL_RATIO = 0.5
const AT_RISK_MIN_SESSIONS = 3
const IMPROVER_WINDOW_SIZE = 3
const INITIAL_LIST_LIMIT = 3

export default function Dashboard({ onNavigate, onOpenStudent }) {
  const [week, setWeek] = useState(null)
  const [list, setList] = useState([])
  const [remaining, setRemaining] = useState(0)
  const [thumunList, setThumunList] = useState([])
  const [overviewSessions, setOverviewSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAllNotTested, setShowAllNotTested] = useState(false)
  const [showAllAtRisk, setShowAllAtRisk] = useState(false)
  const [showAllImprovers, setShowAllImprovers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [w, studentsRes, overview] = await Promise.all([
        sessions.weekly(),
        students.list(),
        sessions.overview().catch(() => ({ sessions: [] })),
      ])
      const s = studentsRes?.students || []
      setWeek(w)
      setList(s)
      setOverviewSessions(Array.isArray(overview?.sessions) ? overview.sessions : [])
      const testedIds = new Set(w?.sessions?.map(x => x.student_id))
      setRemaining(Math.max(0, (s?.length || 0) - testedIds.size))
    } catch (e) {
      setWeek(null)
      setList([])
      setOverviewSessions([])
      setRemaining(0)
      setError(e?.message || 'تعذر تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r => r.json()).then(d => setThumunList(d.thumuns || [])).catch(() => {})
  }, [])

  const studentById = useCallback((id) => list.find(s => s.id === id), [list])

  function openProfile(id) {
    const s = studentById(id)
    if (s && onOpenStudent) onOpenStudent(s, 'students')
  }

  const naqzaLabels = useMemo(() => {
    const labels = []
    for (let n = 1; n <= 20; n++) {
      const first = thumunList.filter(t => t.naqza === n).sort((a, b) => a.id - b.id)[0]
      labels.push(first?.name || `النقزة ${n}`)
    }
    return labels
  }, [thumunList])

  const studentMeta = useMemo(() => {
    const map = new Map()
    for (const s of list) {
      map.set(s.id, { id: s.id, number: Number(s.number || 0), numberLabel: String(s.number ?? '—'), name: s.name || '—' })
    }
    return map
  }, [list])

  const testedStudentIds = useMemo(() => new Set((week?.sessions || []).map(s => s.student_id)), [week])

  const notTestedThisWeek = useMemo(() => {
    return list
      .filter(s => !testedStudentIds.has(s.id))
      .map(s => ({ id: s.id, number: Number(s.number || 0), numberLabel: String(s.number ?? '—'), name: s.name || '—' }))
      .sort((a, b) => a.number - b.number)
  }, [list, testedStudentIds])

  const studentHistoryMap = useMemo(() => {
    const grouped = new Map()
    for (const row of overviewSessions) {
      const id = row?.student_id
      if (!id) continue
      const at = parseTime(row.attempt_at || row.created_at)
      if (!grouped.has(id)) grouped.set(id, [])
      grouped.get(id).push({ score: Number(row.score || 0), passed: Boolean(row.passed), at })
    }
    for (const [, rows] of grouped) rows.sort((a, b) => a.at - b.at)
    return grouped
  }, [overviewSessions])

  const atRiskStudents = useMemo(() => {
    const results = []
    for (const [studentId, rows] of studentHistoryMap.entries()) {
      const recent = rows.slice(-AT_RISK_RECENT_LIMIT)
      if (recent.length < AT_RISK_MIN_SESSIONS) continue
      const avg = average(recent.map(r => r.score))
      const failRatio = recent.filter(r => !r.passed).length / recent.length
      if (avg >= AT_RISK_MIN_AVG && failRatio < AT_RISK_MIN_FAIL_RATIO) continue
      const meta = studentMeta.get(studentId) || { numberLabel: '—', name: '—', number: 999999 }
      results.push({ id: studentId, ...meta, avg, failRatio, recentCount: recent.length })
    }
    return results.sort((a, b) => a.avg - b.avg || b.failRatio - a.failRatio || a.number - b.number)
  }, [studentHistoryMap, studentMeta])

  const topImprovers = useMemo(() => {
    const results = []
    for (const [studentId, rows] of studentHistoryMap.entries()) {
      if (rows.length < IMPROVER_WINDOW_SIZE * 2) continue
      const beforeAvg = average(rows.slice(0, IMPROVER_WINDOW_SIZE).map(r => r.score))
      const afterAvg = average(rows.slice(-IMPROVER_WINDOW_SIZE).map(r => r.score))
      const delta = afterAvg - beforeAvg
      if (delta <= 0) continue
      const meta = studentMeta.get(studentId) || { numberLabel: '—', name: '—', number: 999999 }
      results.push({ id: studentId, ...meta, beforeAvg, afterAvg, delta })
    }
    return results.sort((a, b) => b.delta - a.delta || b.afterAvg - a.afterAvg)
  }, [studentHistoryMap, studentMeta])

  const weeklyGoal = useMemo(() => {
    const target = list.length
    const completed = testedStudentIds.size
    const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
    return { target, completed, percent }
  }, [list.length, testedStudentIds])

  const passCount = countPass(week)
  const failCount = countFail(week)
  const weekSessions = week?.sessions?.length ?? 0
  const top = topStudents(week)

  if (loading && !week && !error) return <div className="loading">جاري التحميل…</div>

  return (
    <div className="stack">
      <PageHeader
        title="الرئيسية"
        subtitle="ملخص الأسبوع الحالي"
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <i className="fa-solid fa-rotate" /> تحديث
          </button>
        )}
      />

      {error && (
        <div className="alert alert--error cluster" style={{ justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={load}>إعادة المحاولة</button>
        </div>
      )}

      <div className="dashboard-hero-stats">
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat__value">{list.length.toLocaleString('ar-EG-u-nu-latn')}</div>
          <div className="dashboard-hero-stat__label">عدد الطلاب</div>
        </div>
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat__value">{remaining.toLocaleString('ar-EG-u-nu-latn')}</div>
          <div className="dashboard-hero-stat__label">متبقون هذا الأسبوع</div>
        </div>
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat__value">{weekSessions.toLocaleString('ar-EG-u-nu-latn')}</div>
          <div className="dashboard-hero-stat__label">اختبارات الأسبوع</div>
        </div>
        <div className="dashboard-hero-stat">
          <div className="dashboard-hero-stat__value">
            {weekSessions ? Math.round((passCount / weekSessions) * 100) : 0}%
          </div>
          <div className="dashboard-hero-stat__label">نسبة النجاح</div>
        </div>
      </div>

      <SectionCard title="نظرة عامة">
        <div className="stat-grid">
          <StatTile label="بداية الأسبوع" value={week?.weekStartDate ? new Date(week.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : '—'} />
          <StatTile label="نجاحات الأسبوع" value={passCount} />
          <StatTile label="إخفاقات الأسبوع" value={failCount} />
          <StatTile label="النقزة الأكثر" value={formatNaqza(mostTestedNaqza(week), thumunList, naqzaLabels)} />
        </div>
      </SectionCard>

      <SectionCard title="أفضل الطلاب هذا الأسبوع">
        {top.length === 0 ? (
          <EmptyState
            title="لا بيانات هذا الأسبوع"
            action={onNavigate && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('weekly')}>
                عرض النظرة الزمنية
              </button>
            )}
          />
        ) : (
          <div className="dashboard-list">
            {top.map((s, i) => (
              <div
                key={s.id}
                className="dashboard-list-item clickable-row"
                role="button"
                tabIndex={0}
                onClick={() => openProfile(s.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(s.id) } }}
              >
                <span className="dashboard-list-title">{`المرتبة ${i + 1}: ${s.number} — ${s.name}`}</span>
                <span className="dashboard-list-meta">{`متوسط ${s.avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} • نجاحات ${s.passes}`}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="طلاب غير مختبرين هذا الأسبوع"
        actions={<button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('students')}>فتح القائمة</button>}
      >
        <WidgetList
          items={notTestedThisWeek}
          showAll={showAllNotTested}
          setShowAll={setShowAllNotTested}
          emptyText="جميع الطلاب اُختبروا"
          renderItem={s => (
            <div
              className="dashboard-list-item clickable-row"
              role="button"
              tabIndex={0}
              onClick={() => openProfile(s.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(s.id) } }}
            >
              <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard
        title="طلاب بحاجة تدخل"
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('leaderboard')}>
            لوحة الصدارة
          </button>
        )}
      >
        <WidgetList items={atRiskStudents} showAll={showAllAtRisk} setShowAll={setShowAllAtRisk} emptyText="لا يوجد طلاب معرّضون للخطر" renderItem={s => (
          <div
            className="dashboard-list-item clickable-row"
            role="button"
            tabIndex={0}
            onClick={() => openProfile(s.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(s.id) } }}
          >
            <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
            <span className="dashboard-list-meta">{`متوسط ${s.avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} • إخفاق ${Math.round(s.failRatio * 100)}%`}</span>
          </div>
        )} />
      </SectionCard>

      <SectionCard title="الأكثر تحسناً">
        <WidgetList items={topImprovers} showAll={showAllImprovers} setShowAll={setShowAllImprovers} emptyText="لا بيانات كافية" renderItem={s => (
          <div
            className="dashboard-list-item clickable-row"
            role="button"
            tabIndex={0}
            onClick={() => openProfile(s.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(s.id) } }}
          >
            <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
            <span className="dashboard-list-meta">{`+${s.delta.toFixed(1)} (${s.beforeAvg.toFixed(1)} → ${s.afterAvg.toFixed(1)})`}</span>
          </div>
        )} />
      </SectionCard>

      <SectionCard title="تقدم هدف الأسبوع">
        <div className="stat-grid stat-grid--fit">
          <StatTile label="الهدف" value={weeklyGoal.target} />
          <StatTile label="المكتمل" value={weeklyGoal.completed} />
          <StatTile label="نسبة الإنجاز" value={`${weeklyGoal.percent}%`} />
        </div>
        <div className="dashboard-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weeklyGoal.percent}>
          <span style={{ width: `${weeklyGoal.percent}%` }} />
        </div>
      </SectionCard>
    </div>
  )
}

function WidgetList({ items, showAll, setShowAll, emptyText, renderItem }) {
  const visible = showAll ? items : items.slice(0, INITIAL_LIST_LIMIT)
  return (
    <>
      <div className="dashboard-list">
        {visible.map(item => (
          <Fragment key={item.id}>{renderItem(item)}</Fragment>
        ))}
        {visible.length === 0 && <EmptyState title={emptyText} icon="fa-check-circle" />}
      </div>
      {items.length > INITIAL_LIST_LIMIT && (
        <button type="button" className="btn btn--ghost dashboard-list-toggle" onClick={() => setShowAll(v => !v)}>
          {showAll ? 'عرض أقل' : 'عرض الكل'}
        </button>
      )}
    </>
  )
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, n) => sum + Number(n || 0), 0) / values.length
}

function parseTime(value) {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function mostTestedNaqza(week) {
  const map = new Map()
  for (const s of week?.sessions || []) {
    if (s.selected_naqza) map.set(s.selected_naqza, (map.get(s.selected_naqza) || 0) + 1)
  }
  const arr = [...map.entries()].sort((a, b) => b[1] - a[1])
  return arr.length ? arr[0][0] : null
}

function countPass(week) { return (week?.sessions || []).filter(s => s.passed).length }
function countFail(week) { return (week?.sessions || []).filter(s => !s.passed).length }

function topStudents(week) {
  const byStudent = new Map()
  for (const s of week?.sessions || []) {
    if (!byStudent.has(s.student_id)) byStudent.set(s.student_id, { id: s.student_id, number: s.student_number, name: s.student_name, sum: 0, cnt: 0, passes: 0 })
    const agg = byStudent.get(s.student_id)
    agg.sum += Number(s.score || 0)
    agg.cnt += 1
    if (s.passed) agg.passes += 1
  }
  return [...byStudent.values()].map(x => ({ ...x, avg: x.cnt ? x.sum / x.cnt : 0 })).sort((a, b) => b.avg - a.avg || b.passes - a.passes).slice(0, 3)
}
