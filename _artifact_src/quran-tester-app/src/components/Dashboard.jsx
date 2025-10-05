import { useEffect, useMemo, useState } from 'react'
import { sessions, students } from '../api'

export default function Dashboard() {
  const [week, setWeek] = useState(null)
  const [list, setList] = useState([])
  const [remaining, setRemaining] = useState(0)
  const [thumunList, setThumunList] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const w = await sessions.weekly()
        const { students: s } = await students.list()
        setWeek(w)
        setList(s)
        // Remaining to test this week = unique students - tested studentIds this week
        const testedIds = new Set(w?.sessions?.map(x => x.student_id))
        setRemaining(Math.max(0, (s?.length || 0) - testedIds.size))
      } catch {}
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

  return (
    <div style={{ width:'100%', maxWidth: 840 }}>
      <div className="card appear" style={{ marginTop: 24 }}>
        <h2>نظرة عامة</h2>
        <div className="info-grid">
          <Info label="عدد الطلاب" value={list.length} />
          <Info label="اختبارات الأسبوع" value={week?.sessions?.length ?? 0} />
          <Info label="بداية الأسبوع" value={week?.weekStartDate ? new Date(week.weekStartDate).toLocaleDateString('ar-EG-u-nu-latn') : '—'} />
          <Info label="طلاب متبقون" value={remaining} />
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

