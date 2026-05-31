import { useEffect, useMemo, useState, useCallback } from 'react'
import { sessions, students } from '../api'
import { formatNaqza } from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import DashboardWidget from './ui/DashboardWidget.jsx'
import DashboardStudentRow from './ui/DashboardStudentRow.jsx'
import EmptyState from './ui/EmptyState.jsx'

const AT_RISK_RECENT_LIMIT = 5
const AT_RISK_MIN_AVG = 60
const AT_RISK_MIN_FAIL_RATIO = 0.5
const AT_RISK_MIN_SESSIONS = 3
const IMPROVER_WINDOW_SIZE = 3
const INITIAL_LIST_LIMIT = 3
const RANK_TONES = ['gold', 'silver', 'bronze']

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
  const passRate = weekSessions ? Math.round((passCount / weekSessions) * 100) : 0
  const top = topStudents(week)
  const weekRange = formatWeekRange(week?.weekStartDate)

  if (loading && !week && !error) return <div className="loading">جاري التحميل…</div>

  return (
    <div className="stack dash-page">
      <PageHeader
        title="الرئيسية"
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

      <section className="dash-summary appear">
        <div className="dash-summary__top">
          <div className="dash-summary__intro">
            <span className="dash-summary__eyebrow">
              <i className="fa-solid fa-calendar-week" aria-hidden="true" />
              ملخص الأسبوع الحالي
            </span>
            {weekRange && <p className="dash-summary__range">{weekRange}</p>}
          </div>
          <div className="dash-summary__ring" aria-hidden="true">
            <svg viewBox="0 0 44 44" className="dash-summary__ring-svg">
              <circle className="dash-summary__ring-track" cx="22" cy="22" r="18" />
              <circle
                className="dash-summary__ring-fill"
                cx="22"
                cy="22"
                r="18"
                style={{ strokeDashoffset: `${113 - (113 * weeklyGoal.percent) / 100}` }}
              />
            </svg>
            <span className="dash-summary__ring-label">{weeklyGoal.percent}%</span>
          </div>
        </div>

        <div className="dash-summary__kpis">
          <div className="dash-kpi">
            <span className="dash-kpi__icon" aria-hidden="true"><i className="fa-solid fa-users" /></span>
            <div>
              <div className="dash-kpi__value">{list.length.toLocaleString('ar-EG-u-nu-latn')}</div>
              <div className="dash-kpi__label">عدد الطلاب</div>
            </div>
          </div>
          <div className="dash-kpi dash-kpi--warn">
            <span className="dash-kpi__icon" aria-hidden="true"><i className="fa-solid fa-hourglass-half" /></span>
            <div>
              <div className="dash-kpi__value">{remaining.toLocaleString('ar-EG-u-nu-latn')}</div>
              <div className="dash-kpi__label">متبقون هذا الأسبوع</div>
            </div>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi__icon" aria-hidden="true"><i className="fa-solid fa-clipboard-check" /></span>
            <div>
              <div className="dash-kpi__value">{weekSessions.toLocaleString('ar-EG-u-nu-latn')}</div>
              <div className="dash-kpi__label">اختبارات الأسبوع</div>
            </div>
          </div>
          <div className="dash-kpi dash-kpi--success">
            <span className="dash-kpi__icon" aria-hidden="true"><i className="fa-solid fa-chart-line" /></span>
            <div>
              <div className="dash-kpi__value">{passRate}%</div>
              <div className="dash-kpi__label">نسبة النجاح</div>
            </div>
          </div>
        </div>

        <div className="dash-summary__goal">
          <div className="dash-summary__goal-text">
            <span>تقدم هدف الأسبوع</span>
            <strong>{weeklyGoal.completed.toLocaleString('ar-EG-u-nu-latn')} / {weeklyGoal.target.toLocaleString('ar-EG-u-nu-latn')}</strong>
          </div>
          <div
            className="dash-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={weeklyGoal.percent}
            aria-label="تقدم هدف الأسبوع"
          >
            <span className="dash-progress__fill" style={{ width: `${weeklyGoal.percent}%` }} />
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <DashboardWidget title="نظرة عامة" icon="fa-gauge-high" variant="default">
          <div className="dash-overview">
            <div className="dash-overview__item">
              <span className="dash-overview__label">بداية الأسبوع</span>
              <span className="dash-overview__value">
                {week?.weekStartDate ? new Date(week.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : '—'}
              </span>
            </div>
            <div className="dash-overview__item dash-overview__item--pass">
              <span className="dash-overview__label">نجاحات</span>
              <span className="dash-overview__value">{passCount.toLocaleString('ar-EG-u-nu-latn')}</span>
            </div>
            <div className="dash-overview__item dash-overview__item--fail">
              <span className="dash-overview__label">إخفاقات</span>
              <span className="dash-overview__value">{failCount.toLocaleString('ar-EG-u-nu-latn')}</span>
            </div>
            <div className="dash-overview__item dash-overview__item--accent">
              <span className="dash-overview__label">النقزة الأكثر</span>
              <span className="dash-overview__value dash-overview__value--sm">
                {formatNaqza(mostTestedNaqza(week), thumunList, naqzaLabels)}
              </span>
            </div>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="أفضل الطلاب هذا الأسبوع"
          icon="fa-trophy"
          variant="success"
          badge={top.length ? top.length : null}
        >
          {top.length === 0 ? (
            <EmptyState
              title="لا بيانات هذا الأسبوع"
              icon="fa-trophy"
              action={onNavigate && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('weekly')}>
                  عرض النظرة الزمنية
                </button>
              )}
            />
          ) : (
            <div className="dash-list">
              {top.map((s, i) => (
                <DashboardStudentRow
                  key={s.id}
                  id={s.id}
                  rank={i + 1}
                  rankTone={RANK_TONES[i] || 'default'}
                  name={s.name}
                  meta={`متوسط ${s.avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} • ${s.passes} نجاح`}
                  onOpen={openProfile}
                />
              ))}
            </div>
          )}
        </DashboardWidget>

        <DashboardWidget
          title="طلاب غير مختبرين هذا الأسبوع"
          icon="fa-user-clock"
          variant="warning"
          badge={notTestedThisWeek.length || null}
          actions={(
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('students')}>
              فتح القائمة
            </button>
          )}
        >
          <WidgetList
            items={notTestedThisWeek}
            showAll={showAllNotTested}
            setShowAll={setShowAllNotTested}
            emptyText="جميع الطلاب اُختبروا"
            emptyIcon="fa-check-circle"
            onOpen={openProfile}
          />
        </DashboardWidget>

        <DashboardWidget
          title="طلاب بحاجة تدخل"
          icon="fa-triangle-exclamation"
          variant="danger"
          badge={atRiskStudents.length || null}
          actions={(
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate?.('leaderboard')}>
              لوحة الصدارة
            </button>
          )}
        >
          <WidgetList
            items={atRiskStudents}
            showAll={showAllAtRisk}
            setShowAll={setShowAllAtRisk}
            emptyText="لا يوجد طلاب بحاجة تدخل"
            emptyIcon="fa-shield-heart"
            onOpen={openProfile}
            renderMeta={s => `متوسط ${s.avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} • إخفاق ${Math.round(s.failRatio * 100)}%`}
          />
        </DashboardWidget>

        <DashboardWidget
          title="الأكثر تحسناً"
          icon="fa-arrow-trend-up"
          variant="improve"
          badge={topImprovers.length || null}
        >
          <WidgetList
            items={topImprovers}
            showAll={showAllImprovers}
            setShowAll={setShowAllImprovers}
            emptyText="لا بيانات كافية"
            emptyIcon="fa-chart-line"
            onOpen={openProfile}
            renderMeta={s => `+${s.delta.toFixed(1)} (${s.beforeAvg.toFixed(1)} → ${s.afterAvg.toFixed(1)})`}
          />
        </DashboardWidget>

        <DashboardWidget title="تقدم هدف الأسبوع" icon="fa-bullseye" variant="goal" className="dash-grid__full">
          <div className="dash-goal">
            <div className="dash-goal__stats">
              <div className="dash-goal__stat">
                <span className="dash-goal__stat-label">الهدف</span>
                <span className="dash-goal__stat-value">{weeklyGoal.target.toLocaleString('ar-EG-u-nu-latn')}</span>
              </div>
              <div className="dash-goal__stat">
                <span className="dash-goal__stat-label">المكتمل</span>
                <span className="dash-goal__stat-value">{weeklyGoal.completed.toLocaleString('ar-EG-u-nu-latn')}</span>
              </div>
              <div className="dash-goal__stat dash-goal__stat--highlight">
                <span className="dash-goal__stat-label">نسبة الإنجاز</span>
                <span className="dash-goal__stat-value">{weeklyGoal.percent}%</span>
              </div>
            </div>
            <div
              className="dash-progress dash-progress--lg"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={weeklyGoal.percent}
            >
              <span className="dash-progress__fill" style={{ width: `${weeklyGoal.percent}%` }} />
            </div>
            <p className="dash-goal__hint meta">
              {weeklyGoal.percent >= 100
                ? 'تم اختبار جميع الطلاب هذا الأسبوع — أحسنت!'
                : `متبقٍ ${remaining.toLocaleString('ar-EG-u-nu-latn')} طالب${remaining === 1 ? '' : ''} لإكمال الهدف`}
            </p>
          </div>
        </DashboardWidget>
      </div>
    </div>
  )
}

function WidgetList({ items, showAll, setShowAll, emptyText, emptyIcon, onOpen, renderMeta }) {
  const visible = showAll ? items : items.slice(0, INITIAL_LIST_LIMIT)
  return (
    <>
      <div className="dash-list">
        {visible.map(s => (
          <DashboardStudentRow
            key={s.id}
            id={s.id}
            numberLabel={s.numberLabel}
            name={s.name}
            meta={renderMeta?.(s)}
            onOpen={onOpen}
          />
        ))}
        {visible.length === 0 && <EmptyState title={emptyText} icon={emptyIcon || 'fa-inbox'} />}
      </div>
      {items.length > INITIAL_LIST_LIMIT && (
        <button type="button" className="btn btn--ghost dash-list-toggle" onClick={() => setShowAll(v => !v)}>
          {showAll ? 'عرض أقل' : `عرض الكل (${items.length})`}
        </button>
      )}
    </>
  )
}

function formatWeekRange(weekStartDate) {
  if (!weekStartDate) return ''
  const start = new Date(weekStartDate)
  if (Number.isNaN(start.getTime())) return ''
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = d => d.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
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
