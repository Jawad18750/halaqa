export default function A11yPanel({ fontScale, highContrast, onFontScaleChange, onContrastChange }) {
  return (
    <div className="a11y-fab">
      <details>
        <summary aria-label="خيارات الوصول"><i className="fa-solid fa-universal-access" /></summary>
        <div className="panel">
          <button type="button" className="btn btn--sm" onClick={() => onFontScaleChange(Math.max(0.85, fontScale - 0.05))}>A-</button>
          <button type="button" className="btn btn--sm" onClick={() => onFontScaleChange(Math.min(1.3, fontScale + 0.05))}>A+</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={highContrast} onChange={e => onContrastChange(e.target.checked)} />
            تباين مرتفع
          </label>
        </div>
      </details>
    </div>
  )
}
