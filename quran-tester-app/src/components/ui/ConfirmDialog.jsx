import { useEffect, useState } from 'react'
import { useMotionMount } from '../../lib/useMotionMount.js'

let confirmState = { open: false, title: '', message: '', confirmLabel: 'تأكيد', cancelLabel: 'إلغاء', resolve: () => {} }

export function confirmDialog(title, message, options = {}) {
  confirmState = {
    open: true,
    title,
    message,
    confirmLabel: options.confirmLabel || 'تأكيد',
    cancelLabel: options.cancelLabel || 'إلغاء',
    resolve: () => {},
  }
  return new Promise((resolve) => {
    confirmState.resolve = resolve
    window.dispatchEvent(new Event('confirm-dialog-change'))
  })
}

export default function ConfirmDialog() {
  const [, tick] = useState(0)
  const [content, setContent] = useState({ title: '', message: '', confirmLabel: 'تأكيد', cancelLabel: 'إلغاء' })
  const open = confirmState.open
  const { render, active } = useMotionMount(open)

  useEffect(() => {
    const h = () => tick(t => t + 1)
    window.addEventListener('confirm-dialog-change', h)
    return () => window.removeEventListener('confirm-dialog-change', h)
  }, [])

  useEffect(() => {
    if (open) {
      setContent({
        title: confirmState.title,
        message: confirmState.message,
        confirmLabel: confirmState.confirmLabel,
        cancelLabel: confirmState.cancelLabel,
      })
    }
  }, [open])

  if (!render) return null

  function close(result) {
    confirmState.open = false
    confirmState.resolve(result)
    window.dispatchEvent(new Event('confirm-dialog-change'))
  }

  return (
    <div
      className={`modal-overlay ${active ? 'modal-overlay--visible' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal ${active ? 'modal--visible' : ''}`}>
        <h3 className="modal__title">{content.title}</h3>
        <div className="modal__body">{content.message}</div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => close(false)}>{content.cancelLabel}</button>
          <button type="button" className="btn btn--primary" onClick={() => close(true)}>{content.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
