export default function SectionCard({ title, actions, children, className = '' }) {
  return (
    <section className={`section-card appear ${className}`.trim()}>
      {(title || actions) && (
        <div className="section-card__head">
          {title && <h2 className="section-card__title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
