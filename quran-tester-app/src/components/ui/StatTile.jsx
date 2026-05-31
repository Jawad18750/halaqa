export default function StatTile({ label, value }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value ?? '—'}</div>
    </div>
  )
}
