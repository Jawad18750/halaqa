const DEFAULT_STEPS = [
  { id: 1, label: 'بيانات' },
  { id: 2, label: 'أولياء' },
  { id: 3, label: 'مراجعة' },
]

export default function FormStepper({
  step,
  totalSteps = 3,
  steps = DEFAULT_STEPS,
  canNext = true,
  canPrev = true,
  nextLabel = 'التالي',
  prevLabel = 'السابق',
  skipLabel = 'تخطي',
  submitLabel = 'حفظ',
  isLast = false,
  saving = false,
  showSkip = false,
  onNext,
  onPrev,
  onSkip,
  onSubmit,
}) {
  const progress = Math.round((step / totalSteps) * 100)

  return (
    <>
      <div className="form-stepper">
        <div className="form-stepper__head">
          <p className="form-stepper__step-label">الخطوة {step} من {totalSteps}</p>
          {showSkip && onSkip && !isLast && (
            <button type="button" className="form-stepper__skip" onClick={onSkip} disabled={saving}>
              {skipLabel}
            </button>
          )}
        </div>
        <div className="form-stepper__progress-wrap">
          <div className="form-stepper__progress" style={{ width: `${progress}%` }} />
        </div>
        <ol className="form-stepper__labels">
          {steps.slice(0, totalSteps).map((s, i) => (
            <li
              key={s.id}
              className={`form-stepper__label ${i + 1 === step ? 'form-stepper__label--active' : ''} ${i + 1 < step ? 'form-stepper__label--done' : ''}`}
            >
              <span className="form-stepper__num">{s.id}</span>
              <span className="form-stepper__label-text">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="form-stepper__bar">
        <div className="form-stepper__bar-inner">
          {canPrev && step > 1 && (
            <button type="button" className="btn btn--ghost form-stepper__btn form-stepper__btn--prev" onClick={onPrev} disabled={saving}>
              {prevLabel}
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className="btn btn--primary form-stepper__btn form-stepper__btn--primary"
              onClick={onSubmit}
              disabled={!canNext || saving}
            >
              {saving ? 'جاري الحفظ…' : submitLabel}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary form-stepper__btn form-stepper__btn--primary"
              onClick={onNext}
              disabled={!canNext || saving}
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
