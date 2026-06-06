import Badge from './Badge.jsx'
import { resultLabel, gradeLabel, formatNaqza } from '../../lib/labels.js'
import { useMotionMount } from '../../lib/useMotionMount.js'

export default function TestResultModal({
  open,
  studentName,
  score,
  passed,
  naqzaAfter,
  naqzaLabels,
  thumuns,
  onProfile,
  onTestAgain,
  onList,
  onViewMessage,
  onClose,
}) {
  const { render, active } = useMotionMount(open)

  if (!render) return null

  const naqzaLabel = passed && naqzaAfter != null
    ? formatNaqza(naqzaAfter, thumuns, naqzaLabels)
    : null

  return (
    <div
      className={`modal-overlay ${active ? 'modal-overlay--visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-result-title"
    >
      <div className={`modal test-result-modal ${active ? 'modal--visible' : ''}`}>
        <h3 className="modal__title" id="test-result-title">تم تسجيل المحاولة</h3>
        <div className="test-result-modal__summary">
          <div className="test-result-modal__student">{studentName}</div>
          <div className="cluster" style={{ justifyContent: 'center', gap: 12 }}>
            <Badge variant={passed ? 'pass' : 'fail'}>{resultLabel(passed)}</Badge>
            <span className="test-result-modal__score">{score}</span>
            <span className="meta">{gradeLabel(score)}</span>
          </div>
          {naqzaLabel && (
            <p className="test-result-modal__progress meta">
              <i className="fa-solid fa-arrow-up" aria-hidden="true" /> النقزة الحالية: {naqzaLabel}
            </p>
          )}
        </div>
        <p className="modal__body">إلى أين تريد الانتقال؟</p>
        <div className="test-result-modal__actions">
          <button type="button" className="btn btn--primary" onClick={onProfile}>
            <i className="fa-solid fa-user" /> الملف
          </button>
          <button type="button" className="btn" onClick={onTestAgain}>
            <i className="fa-solid fa-play" /> اختبار آخر
          </button>
          {onViewMessage && (
            <button type="button" className="btn btn--ghost" onClick={onViewMessage}>
              <i className="fa-brands fa-telegram" /> عرض الرسالة
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onList}>
            <i className="fa-solid fa-users" /> قائمة الطلاب
          </button>
        </div>
        {onClose && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 12, width: '100%' }} onClick={onClose}>
            إغلاق
          </button>
        )}
      </div>
    </div>
  )
}
