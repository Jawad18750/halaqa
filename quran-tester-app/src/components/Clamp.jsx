import { useMemo, useState } from 'react'

export default function Clamp({ text, lines = 2 }) {
  const [expanded, setExpanded] = useState(false)
  const showToggle = useMemo(() => (String(text || '').length > 80), [text])
  return (
    <div style={{ width: '100%' }}>
      <div className={expanded ? 'clamp' : 'clamp clamp--collapsed'} style={{ '--clamp-lines': String(lines) }}>
        {text}
      </div>
      {showToggle && (
        <button className="btn clamp-toggle" onClick={() => setExpanded(v => !v)}>{expanded ? 'عرض أقل' : 'عرض المزيد'}</button>
      )}
    </div>
  )
}


