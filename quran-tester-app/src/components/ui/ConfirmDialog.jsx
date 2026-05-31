import { useEffect, useState } from 'react'

let confirmState = { open: false, title: '', message: '', resolve: () => {} }

export function confirmDialog(title, message) {
  confirmState = { open: true, title, message, resolve: () => {} }
  return new Promise((resolve) => {
    confirmState.resolve = resolve
    window.dispatchEvent(new Event('confirm-dialog-change'))
  })
}

export default function ConfirmDialog() {
  const [, tick] = useState(0)
  useEffect(() => {
    const h = () => tick(t => t + 1)
    window.addEventListener('confirm-dialog-change', h)
    return () => window.removeEventListener('confirm-dialog-change', h)
  }, [])

  if (!confirmState.open) return null

  function close(result) {
    confirmState.open = false
    confirmState.resolve(result)
    window.dispatchEvent(new Event('confirm-dialog-change'))
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 className="modal__title">{confirmState.title}</h3>
        <div className="modal__body">{confirmState.message}</div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => close(false)}>إلغاء</button>
          <button type="button" className="btn btn--primary" onClick={() => close(true)}>تأكيد</button>
        </div>
      </div>
    </div>
  )
}
