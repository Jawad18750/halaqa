import { createPortal } from 'react-dom'
import { useEffect } from 'react'

export default function SheetModalFrame({
  open,
  ariaLabel,
  panelClassName = '',
  onBackdropClick,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="sheet-modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="sheet-modal__backdrop" onClick={onBackdropClick} />
      <div className={`sheet-modal__panel ${panelClassName}`.trim()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
