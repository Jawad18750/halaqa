function podiumTone(rank) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'default'
}

function podiumIcon(rank) {
  if (rank === 1) return 'fa-solid fa-crown'
  if (rank === 2) return 'fa-solid fa-medal'
  if (rank === 3) return 'fa-solid fa-award'
  return 'fa-solid fa-hashtag'
}

export default function LeaderboardPodium({ entries = [], onOpenStudent, photoFor }) {
  if (!entries.length) return null

  const ordered = [
    entries.find(e => e.rank === 2),
    entries.find(e => e.rank === 1),
    entries.find(e => e.rank === 3),
  ].filter(Boolean)

  return (
    <section className={`leaderboard-podium leaderboard-podium--count-${Math.min(entries.length, 3)}`} aria-label="أفضل ثلاثة">
      {ordered.map(item => {
        const tone = podiumTone(item.rank)
        const photo = photoFor?.(item.id)
        return (
          <button
            key={item.id}
            type="button"
            className={`leaderboard-podium__slot leaderboard-podium__slot--${tone} ${item.rank === 1 ? 'leaderboard-podium__slot--first' : ''}`}
            onClick={() => onOpenStudent?.(item.id)}
          >
            <span className={`leaderboard-podium__medal leaderboard-podium__medal--${tone}`} aria-hidden>
              <i className={podiumIcon(item.rank)} />
            </span>
            <span className="leaderboard-podium__avatar-wrap">
              {photo ? (
                <img className="leaderboard-podium__avatar" src={photo} alt="" />
              ) : (
                <span className="leaderboard-podium__avatar leaderboard-podium__avatar--placeholder">
                  {item.student_number}
                </span>
              )}
            </span>
            <span className="leaderboard-podium__rank">{item.rank}</span>
            <strong className="leaderboard-podium__name">{item.student_name}</strong>
            <span className="leaderboard-podium__score">{formatScore(item.avgScore)}</span>
            <span className="leaderboard-podium__label">متوسط</span>
          </button>
        )
      })}
    </section>
  )
}

function formatScore(n) {
  return Number(n || 0).toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })
}
