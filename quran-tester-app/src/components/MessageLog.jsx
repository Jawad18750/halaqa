import { useCallback, useEffect, useMemo, useState } from 'react'
import { notifications } from '../api'
import { formatRangeLabel } from '../lib/labels.js'
import {
  TYPE_FILTERS,
  STATUS_FILTERS,
  groupLogEntries,
} from '../lib/notificationLog.js'
import PageHeader from './ui/PageHeader.jsx'
import DateRangePanel from './ui/DateRangePanel.jsx'
import StatTile from './ui/StatTile.jsx'
import EmptyState from './ui/EmptyState.jsx'
import Toast from './ui/Toast.jsx'
import NotificationLogList from './ui/NotificationLogList.jsx'
import NotificationLogDetailSheet from './ui/NotificationLogDetailSheet.jsx'

function pad2(n) { return String(n).padStart(2, '0') }

function tripoliDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function addDays(dateInput, days) {
  const d = new Date(`${dateInput}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function weekStartSaturday(dateInput = tripoliDateString()) {
  const d = new Date(`${dateInput}T12:00:00`)
  const diff = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export default function MessageLog({
  onBack,
  onNavigate,
  initialFocus = null,
  onFocusConsumed,
}) {
  const initialFrom = weekStartSaturday()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(addDays(initialFrom, 6))
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listMode, setListMode] = useState('timeline')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [batchItems, setBatchItems] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const opts = {
        limit: 100,
        from,
        to,
        search: query.trim() || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sessionId: initialFocus?.sessionId,
        broadcastId: initialFocus?.broadcastId,
        studentId: initialFocus?.studentId,
      }
      const [logRes, statsRes] = await Promise.all([
        notifications.log(opts),
        notifications.logStats(from, to),
      ])
      setEntries(logRes?.entries || [])
      setStats(statsRes?.stats || null)
    } catch (e) {
      setError(e.message || 'تعذر تحميل سجل الرسائل')
      setEntries([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, query, typeFilter, statusFilter, initialFocus?.sessionId, initialFocus?.broadcastId, initialFocus?.studentId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!initialFocus?.entryId || loading) return
    const found = entries.find(e => e.id === initialFocus.entryId)
    if (found) {
      setSelectedEntry(found)
      onFocusConsumed?.()
    }
  }, [initialFocus?.entryId, entries, loading, onFocusConsumed])

  useEffect(() => {
    if (initialFocus?.status) setStatusFilter(initialFocus.status)
    if (initialFocus?.type) setTypeFilter(initialFocus.type)
  }, [initialFocus?.status, initialFocus?.type])

  const groupedItems = useMemo(() => {
    if (listMode !== 'grouped') return []
    return groupLogEntries(entries)
  }, [entries, listMode])

  const rangeSubtitle = formatRangeLabel(from, to)
  const hasFilters = query.trim() || typeFilter !== 'all' || statusFilter !== 'all'

  function clearFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  function setCurrentWeek() {
    const start = weekStartSaturday()
    setFrom(start)
    setTo(addDays(start, 6))
  }

  function openEntry(entry) {
    setSelectedEntry(entry)
    if (entry.batch_id) {
      setBatchItems(entries.filter(e => e.batch_id === entry.batch_id))
    } else {
      setBatchItems(null)
    }
  }

  function openBatch(batch) {
    const sample = batch.items[0]
    if (sample) openEntry(sample)
  }

  function closeSheet() {
    setSelectedEntry(null)
    setBatchItems(null)
  }

  return (
    <div className="stack message-log-page">
      <PageHeader
        title="سجل الرسائل"
        subtitle={rangeSubtitle}
        onBack={onBack}
        actions={(
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} aria-label="تحديث">
            <i className="fa-solid fa-arrows-rotate" />
          </button>
        )}
      />

      <div className="message-log-stats">
        <StatTile label="مرسلة" value={stats?.sent ?? 0} tone="success" />
        <StatTile label="فشلت" value={stats?.failed ?? 0} tone={stats?.failed ? 'danger' : 'default'} />
        <StatTile label="غير مرتبط" value={stats?.no_link ?? 0} tone={stats?.no_link ? 'warn' : 'default'} />
        <StatTile label="الإجمالي" value={stats?.total ?? 0} />
      </div>

      <DateRangePanel
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onCurrentWeek={setCurrentWeek}
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="بحث باسم ولي الأمر أو الطالب"
        searchLabel="بحث في سجل الرسائل"
        footer={(
          <p className="meta message-log-hint">
            تظهر هنا نتائج الاختبارات والحضور الأسبوعي والرسائل اليدوية كما وصلت عبر Telegram.
          </p>
        )}
      />

      <section className="message-log-toolbar" aria-label="تصفية الرسائل">
        <div className="message-log-toolbar__row">
          <p className="message-log-toolbar__label">نوع الرسالة</p>
          {hasFilters && (
            <button type="button" className="btn btn--ghost btn--sm message-log-toolbar__reset" onClick={clearFilters}>
              مسح التصفية
            </button>
          )}
        </div>
        <div className="message-log-toolbar__filters students-filter" role="tablist" aria-label="نوع الرسالة">
          {TYPE_FILTERS.map(chip => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={typeFilter === chip.id}
              className={`students-filter__chip ${typeFilter === chip.id ? 'students-filter__chip--active' : ''}`}
              onClick={() => setTypeFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <p className="message-log-toolbar__label">حالة الإرسال</p>
        <div className="message-log-toolbar__filters students-filter" role="tablist" aria-label="حالة الإرسال">
          {STATUS_FILTERS.map(chip => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === chip.id}
              className={`students-filter__chip ${statusFilter === chip.id ? 'students-filter__chip--active' : ''}`}
              onClick={() => setStatusFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="message-log-toolbar__row message-log-toolbar__row--mode">
          <p className="message-log-toolbar__label">طريقة العرض</p>
          <div className="message-log-mode" role="group" aria-label="طريقة العرض">
            <button
              type="button"
              className={`btn btn--sm ${listMode === 'timeline' ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={listMode === 'timeline'}
              onClick={() => setListMode('timeline')}
            >
              زمني
            </button>
            <button
              type="button"
              className={`btn btn--sm ${listMode === 'grouped' ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={listMode === 'grouped'}
              onClick={() => setListMode('grouped')}
            >
              مجمّع
            </button>
          </div>
        </div>

        <p className="message-log-toolbar__meta meta">
          {loading
            ? 'جاري التحميل…'
            : `${entries.length.toLocaleString('ar-EG-u-nu-latn')} رسالة في الفترة`}
        </p>
      </section>

      {error && <div className="alert alert--error">{error}</div>}

      <section className="message-log-panel">
        {loading ? (
          <div className="loading">جاري تحميل سجل الرسائل…</div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="fa-envelope-open-text"
            title={hasFilters ? 'لا نتائج للتصفية' : 'لا رسائل بعد'}
            message={hasFilters
              ? 'جرّب توسيع الفترة أو إزالة التصفية.'
              : 'لم تُرسل رسائل Telegram بعد. ستظهر هنا نتائج الاختبارات والحضور والرسائل اليدوية تلقائياً.'}
          />
        ) : (
          <NotificationLogList
            entries={listMode === 'timeline' ? entries : []}
            items={listMode === 'grouped' ? groupedItems : []}
            grouped={listMode === 'grouped'}
            onSelect={openEntry}
            onSelectBatch={openBatch}
          />
        )}
      </section>

      <NotificationLogDetailSheet
        open={Boolean(selectedEntry)}
        entry={selectedEntry}
        batchItems={batchItems}
        onClose={closeSheet}
        onOpenStudent={() => {
          closeSheet()
          onNavigate?.('students', { studentId: selectedEntry?.student_id })
        }}
        onOpenGuardians={() => {
          closeSheet()
          onNavigate?.('guardians')
        }}
        onOpenAttendanceLog={() => {
          closeSheet()
          onNavigate?.('attendanceLog')
        }}
      />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}
