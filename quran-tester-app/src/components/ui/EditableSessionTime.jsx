import { useState } from 'react'
import { sessions } from '../../api'
import { formatAttemptDate, formatLocaleDateTime } from '../../lib/labels.js'

function toLocalInput(iso) {
  try {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

function toIsoLocal(input) {
  try {
    const d = new Date(input)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
  } catch {
    return null
  }
}

export default function EditableSessionTime({ session, onSaved, onError, compact = false }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(() => toLocalInput(session.attempt_at || session.created_at))

  async function save() {
    try {
      const iso = toIsoLocal(val)
      if (!iso) return onError?.('تاريخ غير صالح')
      await sessions.updateTime(session.id, iso)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      onError?.(String(e?.message || e))
    }
  }

  if (!editing) {
    return (
      <div className={`editable-time ${compact ? 'editable-time--compact' : ''}`}>
        <span>{formatLocaleDateTime(formatAttemptDate(session))}</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm editable-time__edit"
          aria-label="تعديل الوقت"
          title="تعديل الوقت"
          onClick={() => setEditing(true)}
        >
          <i className="fa-solid fa-pen" />
        </button>
      </div>
    )
  }

  return (
    <div className={`editable-time editable-time--editing ${compact ? 'editable-time--compact' : ''}`}>
      <input type="datetime-local" className="input editable-time__input" value={val} onChange={e => setVal(e.target.value)} />
      <button type="button" className="btn btn--primary btn--sm" aria-label="حفظ" title="حفظ" onClick={save}>
        <i className="fa-solid fa-check" />
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        aria-label="إلغاء"
        title="إلغاء"
        onClick={() => {
          setEditing(false)
          setVal(toLocalInput(session.attempt_at || session.created_at))
        }}
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  )
}
