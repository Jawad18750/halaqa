import { useEffect, useState, useCallback } from 'react'
import { notifications } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import Badge from './ui/Badge.jsx'
import SectionCard from './ui/SectionCard.jsx'
import EmptyState from './ui/EmptyState.jsx'

function pad2(n) { return String(n).padStart(2, '0') }
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(`${dateStr}T12:00:00`)
    return d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

function resultIcon(stat) {
  if (!stat) return null
  if (stat.sent > 0) return { icon: 'fa-check-circle', tone: 'pass', label: 'أُرسل' }
  if (stat.skippedNoRecipient) return { icon: 'fa-user-slash', tone: 'neutral', label: 'لا ولي' }
  if (stat.optOut > 0) return { icon: 'fa-bell-slash', tone: 'warn', label: 'موقوف' }
  if (stat.noLink > 0) return { icon: 'fa-link-slash', tone: 'neutral', label: 'غير مربوط' }
  if (stat.failed > 0) return { icon: 'fa-circle-exclamation', tone: 'fail', label: 'فشل' }
  return null
}

export default function TodayResults({ onBack }) {
  const today = localDateStr()
  const [date, setDate] = useState(today)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState(null)

  const load = useCallback(async (d) => {
    setLoading(true)
    setError('')
    setSendResults(null)
    try {
      const res = await notifications.todaySessions(d)
      const rows = res.sessions || []
      setSessions(rows)
      setSelected(new Set(rows.map(s => s.student_id)))
    } catch (e) {
      setError(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  function toggleAll() {
    if (selected.size === sessions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sessions.map(s => s.student_id)))
    }
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (!selected.size) return
    setSending(true)
    setSendResults(null)
    try {
      const studentIds = [...selected]
      const res = await notifications.sendTodayResults({ studentIds, date })
      setSendResults(res)
    } catch (e) {
      setError(e.message || 'تعذر الإرسال')
    } finally {
      setSending(false)
    }
  }

  const allSelected = sessions.length > 0 && selected.size === sessions.length
  const someSelected = selected.size > 0 && selected.size < sessions.length
  const resultMap = sendResults
    ? Object.fromEntries((sendResults.results || []).map(r => [r.studentId, r.stats]))
    : {}

  return (
    <div className="stack today-results-page">
      <PageHeader
        title="إرسال نتائج اليوم"
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => load(date)} disabled={loading || sending}>
            <i className="fa-solid fa-rotate" />
          </button>
        )}
      />

      <SectionCard title="التاريخ">
        <div className="today-results__date-row">
          <input
            type="date"
            className="input"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
          />
          {date !== today && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(today)}>
              اليوم
            </button>
          )}
        </div>
        <p className="meta" style={{ marginTop: 4 }}>{formatDisplayDate(date)}</p>
      </SectionCard>

      {error && (
        <div className="alert alert--error">{error}</div>
      )}

      {loading ? (
        <div className="loading">جاري التحميل…</div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="لا توجد اختبارات في هذا اليوم"
          icon="fa-clipboard-list"
          body="لم يتم تسجيل أي اختبارات في التاريخ المحدد."
        />
      ) : (
        <>
          <SectionCard
            title={`الطلاب المختبرون (${sessions.length})`}
            actions={(
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={toggleAll}
                disabled={sending}
              >
                {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            )}
          >
            <p className="meta" style={{ marginBottom: 8 }}>
              اختر من تريد إرسال نتائجهم لأولياء أمورهم
            </p>
            <ul className="today-results__list">
              {sessions.map(s => {
                const stat = resultMap[s.student_id]
                const ri = resultIcon(stat)
                const isSelected = selected.has(s.student_id)
                return (
                  <li
                    key={s.student_id}
                    className={`today-results__item ${isSelected ? 'today-results__item--selected' : ''} ${stat ? 'today-results__item--done' : ''}`}
                  >
                    <label className="today-results__label">
                      <input
                        type="checkbox"
                        className="today-results__check"
                        checked={isSelected}
                        disabled={sending || Boolean(stat)}
                        onChange={() => toggle(s.student_id)}
                      />
                      <span className="today-results__student-info">
                        <span className="today-results__name">{s.student_name}</span>
                        <span className="today-results__meta meta">#{s.student_number}</span>
                      </span>
                      <span className="today-results__result">
                        <Badge variant={s.passed ? 'pass' : 'fail'} size="sm">
                          {s.passed ? 'نجح' : 'راسب'}
                        </Badge>
                        <span className="today-results__score">{Math.round(Number(s.score) || 0)}</span>
                      </span>
                    </label>
                    {ri && (
                      <span className={`today-results__send-status today-results__send-status--${ri.tone}`}>
                        <i className={`fa-solid ${ri.icon}`} aria-hidden />
                        {ri.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {sendResults && (
            <SectionCard title="نتيجة الإرسال">
              <div className="today-results__summary">
                {sendResults.summary.sent > 0 && (
                  <div className="today-results__summary-item today-results__summary-item--pass">
                    <i className="fa-solid fa-check-circle" />
                    <span>أُرسل: {sendResults.summary.sent}</span>
                  </div>
                )}
                {sendResults.summary.noLink > 0 && (
                  <div className="today-results__summary-item">
                    <i className="fa-solid fa-link-slash" />
                    <span>غير مربوط: {sendResults.summary.noLink}</span>
                  </div>
                )}
                {sendResults.summary.optOut > 0 && (
                  <div className="today-results__summary-item today-results__summary-item--warn">
                    <i className="fa-solid fa-bell-slash" />
                    <span>موقوف الإشعارات: {sendResults.summary.optOut}</span>
                  </div>
                )}
                {sendResults.summary.failed > 0 && (
                  <div className="today-results__summary-item today-results__summary-item--fail">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>فشل: {sendResults.summary.failed}</span>
                  </div>
                )}
                {sendResults.summary.skippedNoRecipient > 0 && (
                  <div className="today-results__summary-item">
                    <i className="fa-solid fa-user-slash" />
                    <span>بلا ولي أمر: {sendResults.summary.skippedNoRecipient}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <div className="today-results__send-bar">
            <div className="today-results__send-bar-meta">
              <span>{selected.size} من {sessions.length} محدد</span>
              {someSelected && (
                <span className="meta"> · إرسال انتقائي</span>
              )}
            </div>
            <button
              type="button"
              className="btn btn--primary today-results__send-btn"
              disabled={!selected.size || sending || Boolean(sendResults)}
              onClick={handleSend}
            >
              <i className="fa-brands fa-telegram" aria-hidden />
              {sending
                ? 'جاري الإرسال…'
                : sendResults
                  ? 'تم الإرسال'
                  : `إرسال (${selected.size})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
