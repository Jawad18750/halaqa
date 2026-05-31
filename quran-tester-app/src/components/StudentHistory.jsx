import { useEffect, useMemo, useState } from 'react'
import { sessions, getApiUrl } from '../api'
import { formatNaqza, buildNaqzaLabels } from '../lib/labels.js'
import PageHeader from './ui/PageHeader.jsx'
import EmptyState from './ui/EmptyState.jsx'
import SessionCard from './ui/SessionCard.jsx'
import StudentHubHeader, { computeStudentStats } from './ui/StudentHubHeader.jsx'

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'pass', label: 'نجح' },
  { id: 'fail', label: 'فشل' },
]

export default function StudentHistory({ student, thumuns = [], onBack, onTest, onProfile }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const { sessions: s } = await sessions.forStudent(student.id)
        setList(s)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [student.id])

  const naqzaLabels = buildNaqzaLabels(thumuns)
  const currentNaqzaLabel = formatNaqza(student?.current_naqza, thumuns, naqzaLabels)
  const stats = useMemo(() => computeStudentStats(list), [list])

  const filtered = useMemo(() => {
    if (filter === 'pass') return list.filter(s => s.passed)
    if (filter === 'fail') return list.filter(s => !s.passed)
    return list
  }, [list, filter])

  const apiBase = getApiUrl()
  const placeholder = '/profile-placeholder.svg'
  let photoSrc = placeholder
  if (student?.photo_url) {
    let url = student.photo_url
    if (!url.includes('?')) {
      const ver = student?.updated_at ? new Date(student.updated_at).getTime() : Date.now()
      url = `${url}?v=${ver}`
    }
    photoSrc = url.startsWith('http') ? url : `${apiBase}${url}`
  }

  return (
    <div className="stack">
      <PageHeader title="سجل المحاولات" onBack={onBack} />

      <StudentHubHeader
        student={student}
        photoSrc={photoSrc}
        currentNaqzaLabel={currentNaqzaLabel}
        stats={stats}
        compact
        actions={(
          <>
            {onTest && (
              <button type="button" className="btn btn--primary" onClick={onTest}>
                <i className="fa-solid fa-play" /> اختبار
              </button>
            )}
            {onProfile && (
              <button type="button" className="btn btn--ghost" onClick={onProfile}>
                <i className="fa-solid fa-user" /> الملف
              </button>
            )}
          </>
        )}
      />

      <div className="history-filter" role="tablist" aria-label="تصفية السجل">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`history-filter__chip ${filter === f.id ? 'history-filter__chip--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id === 'all' ? ` (${list.length})` : f.id === 'pass' ? ` (${list.filter(s => s.passed).length})` : ` (${list.filter(s => !s.passed).length})`}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'لا يوجد سجلات بعد' : 'لا توجد محاولات بهذا التصفية'}
          icon="fa-clock-rotate-left"
          action={onTest && filter === 'all' && (
            <button type="button" className="btn btn--primary" onClick={onTest}>
              <i className="fa-solid fa-play" /> بدء اختبار
            </button>
          )}
        />
      ) : (
        <div className="session-list">
          {filtered.map(item => (
            <SessionCard key={item.id} session={item} thumuns={thumuns} />
          ))}
        </div>
      )}
    </div>
  )
}
