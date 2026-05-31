import { useEffect, useId, useRef, useState } from 'react'
import { telegramStatus } from '../../lib/guardianUi.js'

export default function GuardianPickField({ guardians, value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const labelId = useId()

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selected = guardians.find(g => g.id === value)
  const triggerLabel = selected
    ? `${selected.name} (${selected.phone_e164})`
    : '— اختر —'

  if (!guardians.length) {
    return (
      <div className="field guardian-pick guardian-pick--empty">
        <span className="field__label">اختر ولي الأمر</span>
        <p className="guardian-pick__empty">
          لا يوجد أولياء مسجّلون بعد. استخدم «جديد» لإضافة ولي، أو سجّلهم من صفحة أولياء الأمور أولاً.
        </p>
      </div>
    )
  }

  return (
    <div className={`guardian-pick field ${open ? 'guardian-pick--open' : ''}`} ref={rootRef}>
      <span className="field__label" id={labelId}>اختر ولي الأمر</span>
      <button
        type="button"
        className="guardian-pick__trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="guardian-pick__value">{triggerLabel}</span>
        <i className={`fa-solid fa-chevron-down guardian-pick__chevron ${open ? 'guardian-pick__chevron--open' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="guardian-pick__menu" role="listbox" aria-labelledby={labelId}>
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`guardian-pick__option ${!value ? 'guardian-pick__option--active' : ''}`}
              onClick={() => { onChange(''); setOpen(false) }}
            >
              — اختر —
            </button>
          </li>
          {guardians.map(g => {
            const tg = telegramStatus(g)
            const active = value === g.id
            return (
              <li key={g.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`guardian-pick__option ${active ? 'guardian-pick__option--active' : ''}`}
                  onClick={() => { onChange(g.id); setOpen(false) }}
                >
                  <span className="guardian-pick__option-name">{g.name}</span>
                  <span className="guardian-pick__option-meta" dir="ltr">{g.phone_e164} · {tg.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
