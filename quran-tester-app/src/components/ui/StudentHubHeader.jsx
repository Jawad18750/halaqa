import StatTile from './StatTile.jsx'

export default function StudentHubHeader({
  student,
  photoSrc,
  currentNaqzaLabel,
  stats,
  dob,
  onDobChange,
  onDobBlur,
  onPhotoPick,
  actions,
  compact = false,
}) {
  return (
    <section className={`student-hub ${compact ? 'student-hub--compact' : ''}`}>
      <div className="student-hub__hero">
        <div className="student-hub__avatar-wrap">
          <img
            className="student-hub__avatar"
            src={photoSrc}
            alt=""
            width={compact ? 64 : 88}
            height={compact ? 64 : 88}
          />
          {!compact && onPhotoPick && (
            <label className="student-hub__photo-btn" aria-label="تحميل صورة">
              <i className="fa-solid fa-camera" />
              <input type="file" accept="image/*" onChange={onPhotoPick} hidden />
            </label>
          )}
        </div>
        <div className="student-hub__identity">
          <h2 className="student-hub__name">{student.name}</h2>
          <div className="student-hub__chips">
            <span className="student-hub__chip">#{student.number}</span>
            <span className="student-hub__chip student-hub__chip--accent">{currentNaqzaLabel}</span>
          </div>
          {!compact && onDobChange && (
            <label className="student-hub__dob">
              <span className="student-hub__dob-label">تاريخ الميلاد</span>
              <input
                className="input"
                type="date"
                value={dob || ''}
                onChange={onDobChange}
                onBlur={onDobBlur}
              />
            </label>
          )}
        </div>
      </div>

      {stats && (
        <div className="student-hub__stats">
          <StatTile label="المحاولات" value={stats.attempts} />
          <StatTile label="نسبة النجاح" value={`${stats.passRate}%`} />
          <StatTile label="المتوسط" value={stats.avgScore} />
        </div>
      )}

      {actions && <div className="student-hub__actions">{actions}</div>}
    </section>
  )
}

export function computeStudentStats(sessions) {
  const rows = sessions || []
  const attempts = rows.length
  if (!attempts) return { attempts: 0, passRate: 0, avgScore: '—' }
  const passes = rows.filter(r => r.passed).length
  const passRate = Math.round((passes / attempts) * 100)
  const avg = rows.reduce((s, r) => s + Number(r.score || 0), 0) / attempts
  const avgScore = avg.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })
  return { attempts, passRate, avgScore }
}
