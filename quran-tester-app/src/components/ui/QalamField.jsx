import { formatQalamLabel } from '../../lib/labels.js'

export default function QalamField({ value = 1, onChange, disabled = false, onSave, saving = false, dirty = false }) {
  const count = Math.max(1, Math.min(20, Number(value) || 1))

  return (
    <details className="profile-qalam">
      <summary className="profile-qalam__summary">
        <span className="profile-qalam__summary-text">
          <i className="fa-solid fa-book-quran profile-qalam__icon" aria-hidden />
          القلم
        </span>
        <span className="profile-qalam__badge">{formatQalamLabel(count)}</span>
      </summary>
      <div className="profile-qalam__body">
        <p className="profile-qalam__hint meta">
          عدد مرات إتمام حفظ القرآن كاملاً — القلم الأول هو المسار الافتراضي لكل طالب. يُحدَّث نادراً (مرة في السنة أو أقل).
        </p>
        <div className="profile-qalam__stepper" role="group" aria-label="عدد الأقلام">
          <button
            type="button"
            className="profile-qalam__stepper-btn"
            aria-label="تقليل"
            disabled={disabled || saving || count <= 1}
            onClick={() => onChange?.(count - 1)}
          >
            −
          </button>
          <span className="profile-qalam__stepper-value" aria-live="polite">{count}</span>
          <button
            type="button"
            className="profile-qalam__stepper-btn"
            aria-label="زيادة"
            disabled={disabled || saving || count >= 20}
            onClick={() => onChange?.(count + 1)}
          >
            +
          </button>
        </div>
        <p className="profile-qalam__label meta">{formatQalamLabel(count)}</p>
        {dirty && (
          <button
            type="button"
            className="btn btn--primary btn--sm profile-qalam__save"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? 'جاري الحفظ…' : 'حفظ القلم'}
          </button>
        )}
      </div>
    </details>
  )
}
