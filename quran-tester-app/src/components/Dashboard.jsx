import { useEffect, useMemo, useState } from 'react'
import { sessions, students } from '../api'

const AT_RISK_RECENT_LIMIT = 5
const AT_RISK_MIN_AVG = 60
const AT_RISK_MIN_FAIL_RATIO = 0.5
const AT_RISK_MIN_SESSIONS = 3
const IMPROVER_WINDOW_SIZE = 3
const INITIAL_LIST_LIMIT = 3

export default function Dashboard({ onNavigate }) {
  const [week, setWeek] = useState(null)
  const [list, setList] = useState([])
  const [remaining, setRemaining] = useState(0)
  const [thumunList, setThumunList] = useState([])
  const [overviewSessions, setOverviewSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllNotTested, setShowAllNotTested] = useState(false)
  const [showAllAtRisk, setShowAllAtRisk] = useState(false)
  const [showAllImprovers, setShowAllImprovers] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [w, studentsRes, overview] = await Promise.all([
          sessions.weekly(),
          students.list(),
          sessions.overview().catch(() => ({ sessions: [] }))
        ])
        const s = studentsRes?.students || []
        const fullSessions = Array.isArray(overview?.sessions) ? overview.sessions : []
        setWeek(w)
        setList(s)
        setOverviewSessions(fullSessions)
        // Remaining to test this week = unique students - tested studentIds this week
        const testedIds = new Set(w?.sessions?.map(x => x.student_id))
        setRemaining(Math.max(0, (s?.length || 0) - testedIds.size))
      } catch {
        setWeek(null)
        setList([])
        setOverviewSessions([])
        setRemaining(0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r => r.json()).then(d => setThumunList(d.thumuns || [])).catch(() => {})
  }, [])

  const JUZ_NAMES = useMemo(() => ([
    'الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا',
    'يعتذرون', 'وما من دابة', 'وما أبرئ نفسي', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب', 'قد أفلح', 'وقال الذين', 'أمن خلق',
    'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم السجدة', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'
  ]), [])

  const naqzaLabels = useMemo(() => {
    const labels = []
    for (let n = 1; n <= 20; n++) {
      const first = thumunList.filter(t => t.naqza === n).sort((a, b) => a.id - b.id)[0]
      labels.push(first && first.name ? first.name : `النقزة ${n}`)
    }
    return labels
  }, [thumunList])

  const studentMeta = useMemo(() => {
    const map = new Map()
    for (const s of list) {
      map.set(s.id, {
        id: s.id,
        number: Number(s.number || 0),
        numberLabel: String(s.number ?? '—'),
        name: s.name || '—'
      })
    }
    return map
  }, [list])

  const testedStudentIds = useMemo(() => new Set((week?.sessions || []).map(s => s.student_id)), [week])

  const notTestedThisWeek = useMemo(() => {
    const items = list
      .filter(s => !testedStudentIds.has(s.id))
      .map(s => ({
        id: s.id,
        number: Number(s.number || 0),
        numberLabel: String(s.number ?? '—'),
        name: s.name || '—'
      }))
    items.sort((a, b) => a.number - b.number)
    return items
  }, [list, testedStudentIds])

  const studentHistoryMap = useMemo(() => {
    const grouped = new Map()
    for (const row of overviewSessions) {
      const id = row?.student_id
      if (!id) continue
      const at = parseTime(row.attempt_at || row.created_at)
      if (!grouped.has(id)) grouped.set(id, [])
      grouped.get(id).push({
        score: Number(row.score || 0),
        passed: Boolean(row.passed),
        at,
      })
    }
    for (const [, rows] of grouped) {
      rows.sort((a, b) => a.at - b.at)
    }
    return grouped
  }, [overviewSessions])

  const atRiskStudents = useMemo(() => {
    const results = []
    for (const [studentId, rows] of studentHistoryMap.entries()) {
      const recent = rows.slice(-AT_RISK_RECENT_LIMIT)
      if (recent.length < AT_RISK_MIN_SESSIONS) continue
      const avg = average(recent.map(r => r.score))
      const failRatio = recent.filter(r => !r.passed).length / recent.length
      const isAtRisk = avg < AT_RISK_MIN_AVG || failRatio >= AT_RISK_MIN_FAIL_RATIO
      if (!isAtRisk) continue

      const meta = studentMeta.get(studentId) || { id: studentId, number: 999999, numberLabel: '—', name: '—' }
      results.push({
        id: studentId,
        number: meta.number,
        numberLabel: meta.numberLabel,
        name: meta.name,
        avg,
        failRatio,
        recentCount: recent.length
      })
    }
    results.sort((a, b) => {
      if (a.avg !== b.avg) return a.avg - b.avg
      if (a.failRatio !== b.failRatio) return b.failRatio - a.failRatio
      return a.number - b.number
    })
    return results
  }, [studentHistoryMap, studentMeta])

  const topImprovers = useMemo(() => {
    const results = []
    for (const [studentId, rows] of studentHistoryMap.entries()) {
      if (rows.length < IMPROVER_WINDOW_SIZE * 2) continue
      const firstWindow = rows.slice(0, IMPROVER_WINDOW_SIZE)
      const lastWindow = rows.slice(-IMPROVER_WINDOW_SIZE)
      const beforeAvg = average(firstWindow.map(r => r.score))
      const afterAvg = average(lastWindow.map(r => r.score))
      const delta = afterAvg - beforeAvg
      if (delta <= 0) continue

      const meta = studentMeta.get(studentId) || { id: studentId, number: 999999, numberLabel: '—', name: '—' }
      results.push({
        id: studentId,
        number: meta.number,
        numberLabel: meta.numberLabel,
        name: meta.name,
        beforeAvg,
        afterAvg,
        delta,
        sessionsCount: rows.length
      })
    }
    results.sort((a, b) => b.delta - a.delta || b.afterAvg - a.afterAvg)
    return results
  }, [studentHistoryMap, studentMeta])

  const weeklyGoal = useMemo(() => {
    const target = list.length
    const completed = testedStudentIds.size
    const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
    return { target, completed, percent }
  }, [list.length, testedStudentIds])

  return (
    <div style={{ width:'100%', maxWidth: 840 }}>
      <div className="card appear" style={{ marginTop: 24 }}>
        <h2>نظرة عامة</h2>
        <div className="info-grid">
          <Info label="عدد الطلاب" value={list.length} />
          <Info label="اختبارات الأسبوع" value={week?.sessions?.length ?? 0} />
          <Info label="بداية الأسبوع" value={week?.weekStartDate ? new Date(week.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : '—'} />
          <Info label="طلاب متبقون" value={loading ? '—' : remaining} />
        </div>
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <h2>إحصاءات سريعة</h2>
        <div className="info-grid">
          <Info label="النقزة الأكثر" value={formatNaqza(mostTestedNaqza(week), naqzaLabels)} />
          <Info label="الجزء الأكثر" value={formatJuz(mostTestedJuz(week), JUZ_NAMES)} />
          <Info label="نجاحات الأسبوع" value={countPass(week)} />
          <Info label="إخفاقات الأسبوع" value={countFail(week)} />
        </div>
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <h2>أفضل الطلاب هذا الأسبوع</h2>
        <div className="info-grid">
          {topStudents(week).map((s, i) => (
            <div key={s.id || i} className="info" title={`${s.number} — ${s.name} — متوسط ${s.avg.toFixed(1)} — نجاحات ${s.passes}`}>
              <div className="info-label">{`المرتبة ${i+1}`}</div>
              <div className="info-value truncate-2">{`${s.number} — ${s.name} — ${s.avg.toLocaleString('ar-EG-u-nu-latn')}`}</div>
            </div>
          ))}
          {topStudents(week).length === 0 && <div className="info"><div className="info-label">لا بيانات</div><div className="info-value">—</div></div>}
        </div>
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <div className="dashboard-card-head">
          <h2>طلاب غير مختبرين هذا الأسبوع</h2>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('students')}>فتح قائمة الطلاب</button>
        </div>
        <WidgetList
          items={notTestedThisWeek}
          showAll={showAllNotTested}
          setShowAll={setShowAllNotTested}
          emptyText={loading ? 'جاري التحميل…' : 'لا بيانات'}
          renderItem={(s) => (
            <div className="dashboard-list-item" title={`${s.numberLabel} — ${s.name}`}>
              <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
            </div>
          )}
        />
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <div className="dashboard-card-head">
          <h2>طلاب بحاجة تدخل</h2>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('students')}>فتح قائمة الطلاب</button>
        </div>
        <WidgetList
          items={atRiskStudents}
          showAll={showAllAtRisk}
          setShowAll={setShowAllAtRisk}
          emptyText={loading ? 'جاري التحميل…' : 'لا بيانات'}
          renderItem={(s) => (
            <div className="dashboard-list-item" title={`${s.numberLabel} — ${s.name}`}>
              <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
              <span className="dashboard-list-meta">
                {`متوسط ${s.avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} • إخفاق ${Math.round(s.failRatio * 100).toLocaleString('ar-EG-u-nu-latn')}%`}
              </span>
            </div>
          )}
        />
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <h2>الأكثر تحسنا</h2>
        <WidgetList
          items={topImprovers}
          showAll={showAllImprovers}
          setShowAll={setShowAllImprovers}
          emptyText={loading ? 'جاري التحميل…' : 'لا بيانات'}
          renderItem={(s) => (
            <div className="dashboard-list-item" title={`${s.numberLabel} — ${s.name}`}>
              <span className="dashboard-list-title">{`${s.numberLabel} — ${s.name}`}</span>
              <span className="dashboard-list-meta">
                {`+${s.delta.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} (من ${s.beforeAvg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })} إلى ${s.afterAvg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })})`}
              </span>
            </div>
          )}
        />
      </div>

      <div className="card appear" style={{ marginTop: 12 }}>
        <h2>تقدم هدف الأسبوع</h2>
        <div className="info-grid info-grid--fit">
          <Info label="الهدف الأسبوعي" value={weeklyGoal.target.toLocaleString('ar-EG-u-nu-latn')} />
          <Info label="المكتمل" value={weeklyGoal.completed.toLocaleString('ar-EG-u-nu-latn')} />
          <Info label="نسبة الإنجاز" value={`${weeklyGoal.percent.toLocaleString('ar-EG-u-nu-latn')}%`} />
        </div>
        <div className="dashboard-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weeklyGoal.percent}>
          <span style={{ width: `${weeklyGoal.percent}%` }} />
        </div>
      </div>
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

function WidgetList({ items, showAll, setShowAll, emptyText, renderItem }) {
  const visible = showAll ? items : items.slice(0, INITIAL_LIST_LIMIT)
  return (
    <>
      <div className="dashboard-list">
        {visible.map(renderItem)}
        {visible.length === 0 && (
          <div className="dashboard-list-item">
            <span className="dashboard-list-title">{emptyText}</span>
          </div>
        )}
      </div>
      {items.length > INITIAL_LIST_LIMIT && (
        <button className="btn btn--ghost dashboard-list-toggle" onClick={() => setShowAll(v => !v)}>
          {showAll ? 'عرض أقل' : 'عرض كل العناصر'}
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
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function mostTestedNaqza(week) {
  const map = new Map()
  for (const s of week?.sessions || []) {
    if (s.selected_naqza) map.set(s.selected_naqza, (map.get(s.selected_naqza) || 0) + 1)
  }
  const arr = [...map.entries()].sort((a,b) => b[1]-a[1])
  return arr.length ? arr[0][0] : null
}

function mostTestedJuz(week) {
  const map = new Map()
  for (const s of week?.sessions || []) {
    if (s.selected_juz) map.set(s.selected_juz, (map.get(s.selected_juz) || 0) + 1)
  }
  const arr = [...map.entries()].sort((a,b) => b[1]-a[1])
  return arr.length ? arr[0][0] : null
}

function countPass(week) {
  return (week?.sessions || []).filter(s => s.passed).length
}

function countFail(week) {
  return (week?.sessions || []).filter(s => !s.passed).length
}

function topStudents(week){
  const byStudent = new Map()
  for (const s of week?.sessions || []) {
    const key = s.student_id
    if (!byStudent.has(key)) byStudent.set(key, { id: key, number: s.student_number, name: s.student_name, sum:0, cnt:0, passes:0 })
    const agg = byStudent.get(key)
    agg.sum += Number(s.score || 0)
    agg.cnt += 1
    if (s.passed) agg.passes += 1
  }
  const arr = [...byStudent.values()].map(x => ({ ...x, avg: x.cnt ? x.sum / x.cnt : 0 }))
  arr.sort((a,b) => b.avg - a.avg || b.passes - a.passes)
  return arr.slice(0,3)
}

function formatNaqza(n, labels){
  const num = Number(n)
  if (!num) return '—'
  const name = labels[num - 1] || `النقزة ${num}`
  return `${num.toLocaleString('ar-EG-u-nu-latn')} - ${name}`
}

function formatJuz(n, names){
  const num = Number(n)
  if (!num) return '—'
  const name = names[num - 1] || `الجزء ${num}`
  return `${num.toLocaleString('ar-EG-u-nu-latn')} - ${name}`
}

