import { useEffect, useState } from 'react'
import { notifications } from '../../api'
import NotificationLogList from './NotificationLogList.jsx'
import NotificationLogDetailSheet from './NotificationLogDetailSheet.jsx'

export default function StudentMessageLogSection({
  studentId,
  onNavigate,
  onOpenFullLog,
}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    notifications.log({ limit: 8, studentId })
      .then(res => { if (!cancelled) setEntries(res?.entries || []) })
      .catch(() => { if (!cancelled) setEntries([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [studentId])

  return (
    <div className="student-message-log">
      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : entries.length === 0 ? (
        <p className="meta">لم تُرسل رسائل Telegram لهذا الطالب بعد.</p>
      ) : (
        <NotificationLogList
          entries={entries}
          compact
          onSelect={setSelectedEntry}
          emptyTitle=""
          emptyMessage=""
        />
      )}
      {onOpenFullLog && entries.length > 0 && (
        <button type="button" className="btn btn--ghost student-message-log__more" onClick={onOpenFullLog}>
          عرض سجل الرسائل الكامل
        </button>
      )}
      <NotificationLogDetailSheet
        open={Boolean(selectedEntry)}
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onOpenGuardians={() => {
          setSelectedEntry(null)
          onNavigate?.('guardians')
        }}
      />
    </div>
  )
}
