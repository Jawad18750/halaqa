const RANK_TONES = { 1: 'gold', 2: 'silver', 3: 'bronze' }

export default function LeaderboardRankRow({
  item,
  thumuns,
  modeLabel,
  formatThumunId,
  onOpenStudent,
  onNotifyParent,
  notifying,
}) {
  const tone = RANK_TONES[item.rank]
  const metaParts = [
    `${item.attempts} محاولة`,
    `${formatScore(item.passRate)}% نجاح`,
    item.dominantMode ? modeLabel(item.dominantMode) : null,
    item.dominantThumun ? formatThumunId(item.dominantThumun, thumuns) : null,
  ].filter(Boolean)

  return (
    <article className={`leaderboard-row ${tone ? `leaderboard-row--${tone}` : ''}`}>
      <button
        type="button"
        className="leaderboard-row__main"
        onClick={() => onOpenStudent?.(item.id)}
      >
        <span className={`leaderboard-row__rank ${tone ? `leaderboard-row__rank--${tone}` : ''}`}>
          {item.rank}
        </span>
        <span className="leaderboard-row__body">
          <span className="leaderboard-row__name">
            <span className="leaderboard-row__num">{item.student_number}</span>
            {item.student_name}
          </span>
          <span className="leaderboard-row__meta">{metaParts.join(' · ')}</span>
        </span>
        <span className="leaderboard-row__scores">
          <span className="leaderboard-row__avg">{formatScore(item.avgScore)}</span>
          <span className="leaderboard-row__avg-label">متوسط</span>
        </span>
        <i className="fa-solid fa-chevron-left leaderboard-row__chev" aria-hidden />
      </button>

      {onNotifyParent && (
        <button
          type="button"
          className="btn btn--ghost btn--icon leaderboard-row__notify"
          title="تقرير اختبارات لولي الأمر"
          aria-label={`إرسال تقرير اختبارات ${item.student_name} لولي الأمر`}
          disabled={notifying === item.id}
          onClick={e => { e.stopPropagation(); onNotifyParent(item) }}
        >
          <i className="fa-solid fa-paper-plane" />
        </button>
      )}
    </article>
  )
}

function formatScore(n) {
  return Number(n || 0).toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 1 })
}
