import Badge from './Badge.jsx'
import Clamp from '../Clamp.jsx'
import EditableSessionTime from './EditableSessionTime.jsx'
import {
  modeLabel,
  resultLabel,
  gradeLabel,
  formatAttemptDate,
  formatLocaleDateTime,
  formatThumunId,
  formatNaqza,
  dayName,
  formatLatn,
} from '../../lib/labels.js'

export default function SessionCard({
  session,
  thumuns,
  className = '',
  onDelete,
  studentNumber,
  studentName,
  allowTimeEdit = false,
  onTimeSaved,
  onTimeError,
}) {
  if (!session) return null
  const passed = Boolean(session.passed)
  const attemptIso = formatAttemptDate(session)
  const thumun = (thumuns || []).find(x => x.id === Number(session.thumun_id))
  const naqzaVal = session.naqza ?? thumun?.naqza
  const showStudent = studentName || studentNumber != null

  return (
    <article className={`session-card ${passed ? 'session-card--pass' : 'session-card--fail'} ${className}`.trim()}>
      {showStudent && (
        <div className="session-card__student">
          {studentNumber != null && (
            <span className="session-card__student-num">{formatLatn(studentNumber)}</span>
          )}
          <strong className="session-card__student-name">{studentName || '—'}</strong>
        </div>
      )}

      <header className="session-card__head">
        <Badge variant={passed ? 'pass' : 'fail'}>{resultLabel(passed)}</Badge>
        {allowTimeEdit ? (
          <EditableSessionTime
            session={session}
            onSaved={onTimeSaved}
            onError={onTimeError}
            compact
          />
        ) : (
          <time className="session-card__date meta">{formatLocaleDateTime(attemptIso)}</time>
        )}
      </header>

      <div className="session-card__thumun">
        <span className="session-card__thumun-id">#{session.thumun_id}</span>
        <Clamp text={thumun?.name || formatThumunId(session.thumun_id, thumuns)} />
      </div>

      <div className="session-card__grid">
        <div className="session-card__stat">
          <span className="session-card__stat-label">الوضع</span>
          <span>{modeLabel(session.mode)}</span>
        </div>
        {naqzaVal != null && naqzaVal !== '' && (
          <div className="session-card__stat">
            <span className="session-card__stat-label">النقزة</span>
            <span>{formatNaqza(naqzaVal, thumuns)}</span>
          </div>
        )}
        <div className="session-card__stat">
          <span className="session-card__stat-label">الفتحة</span>
          <span>{session.fatha_prompts ?? 0}</span>
        </div>
        <div className="session-card__stat">
          <span className="session-card__stat-label">التردد</span>
          <span>{session.taradud_count ?? 0}</span>
        </div>
        <div className="session-card__stat session-card__stat--score">
          <span className="session-card__stat-label">الدرجة</span>
          <strong>{session.score ?? '—'}</strong>
          <span className="meta">{gradeLabel(session.score)}</span>
        </div>
      </div>

      <footer className="session-card__foot meta">
        {dayName(session.attempt_day)}
        {onDelete && (
          <button type="button" className="btn btn--ghost btn--sm session-card__delete" aria-label="حذف المحاولة" onClick={onDelete}>
            <i className="fa-solid fa-trash" />
          </button>
        )}
      </footer>
    </article>
  )
}
