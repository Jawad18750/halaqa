import Badge from './Badge.jsx'
import { resultLabel, gradeLabel } from '../../lib/labels.js'

export default function TestResultModal({ open, studentName, score, passed, onProfile, onTestAgain, onList, onClose }) {
  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="test-result-title">
      <div className="modal test-result-modal">
        <h3 className="modal__title" id="test-result-title">تم تسجيل المحاولة</h3>
        <div className="test-result-modal__summary">
          <div className="test-result-modal__student">{studentName}</div>
          <div className="cluster" style={{ justifyContent: 'center', gap: 12 }}>
            <Badge variant={passed ? 'pass' : 'fail'}>{resultLabel(passed)}</Badge>
            <span className="test-result-modal__score">{score}</span>
            <span className="meta">{gradeLabel(score)}</span>
          </div>
        </div>
        <p className="modal__body">إلى أين تريد الانتقال؟</p>
        <div className="test-result-modal__actions">
          <button type="button" className="btn btn--primary" onClick={onProfile}>
            <i className="fa-solid fa-user" /> الملف
          </button>
          <button type="button" className="btn" onClick={onTestAgain}>
            <i className="fa-solid fa-play" /> اختبار آخر
          </button>
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
