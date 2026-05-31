import { telegramStatus } from '../../lib/guardianUi.js'
import GuardianPickField from './GuardianPickField.jsx'

export default function GuardianFormRows({
  rows,
  existingGuardians = [],
  onAdd,
  onUpdate,
  onRemove,
  onSkip,
}) {
  if (rows.length === 0) {
    return (
      <div className="guardian-form-empty">
        <div className="guardian-form-empty__icon" aria-hidden>
          <i className="fa-solid fa-user-group" />
        </div>
        <h3 className="guardian-form-empty__title">ربط ولي أمر</h3>
        <p className="meta guardian-form-empty__text">
          اختياري — يمكن إضافة ولي جديد أو اختيار ولي مسجّل. بعد الربط أرسل دعوة برابط أو رقم (6 أرقام) ليصل ولي الأمر نتائج الاختبار 📬
        </p>
        <div className="guardian-form-empty__actions">
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            <i className="fa-solid fa-plus" /> إضافة ولي أمر
          </button>
          {onSkip && (
            <button type="button" className="btn btn--ghost" onClick={onSkip}>
              تخطي — إضافة لاحقاً
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="guardian-form-rows">
      {rows.map((row, index) => (
        <div key={row.id} className="guardian-form-row">
          <div className="guardian-form-row__head">
            <span className="guardian-form-row__title">ولي {index + 1}</span>
            <button type="button" className="btn btn--ghost btn--icon" aria-label="حذف" onClick={() => onRemove(row.id)}>
              <i className="fa-solid fa-trash" />
            </button>
          </div>

          <div className="guardian-form-row__mode" role="group" aria-label="نوع ولي الأمر">
            <button
              type="button"
              className={`guardian-form-row__mode-btn ${row.mode === 'new' ? 'guardian-form-row__mode-btn--active' : ''}`}
              onClick={() => onUpdate(row.id, { mode: 'new', guardianId: '' })}
            >
              جديد
            </button>
            <button
              type="button"
              className={`guardian-form-row__mode-btn ${row.mode === 'existing' ? 'guardian-form-row__mode-btn--active' : ''}`}
              disabled={existingGuardians.length === 0}
              title={existingGuardians.length === 0 ? 'لا يوجد أولياء مسجّلون بعد' : undefined}
              onClick={() => onUpdate(row.id, { mode: 'existing', name: '', phone: '' })}
            >
              موجود
            </button>
          </div>

          {row.mode === 'existing' ? (
            <>
              <GuardianPickField
                guardians={existingGuardians}
                value={row.guardianId}
                onChange={guardianId => onUpdate(row.id, { guardianId })}
              />
              {row.guardianId && (() => {
                const g = existingGuardians.find(x => x.id === row.guardianId)
                if (!g) return null
                const tg = telegramStatus(g)
                return <span className={`guardian-badge ${tg.className}`}>{tg.label}</span>
              })()}
            </>
          ) : (
            <>
              <label className="field">
                <span className="field__label">اسم ولي الأمر</span>
                <input className="input" value={row.name} onChange={e => onUpdate(row.id, { name: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">الهاتف</span>
                <input
                  className="input"
                  type="tel"
                  dir="ltr"
                  placeholder="09xxxxxxxx"
                  value={row.phone}
                  onChange={e => onUpdate(row.id, { phone: e.target.value })}
                />
              </label>
            </>
          )}

          <label className="field">
            <span className="field__label">صلة القرابة</span>
            <input
              className="input"
              placeholder="أب، أم، …"
              value={row.relationship}
              onChange={e => onUpdate(row.id, { relationship: e.target.value })}
            />
          </label>

          <div className="guardian-form-row__flags">
            <label className="add-student-check">
              <input
                type="checkbox"
                checked={row.isPrimary}
                onChange={e => onUpdate(row.id, { isPrimary: e.target.checked })}
              />
              ولي أساسي
            </label>
            <label className="add-student-check">
              <input
                type="checkbox"
                checked={row.notifyOnResult}
                onChange={e => onUpdate(row.id, { notifyOnResult: e.target.checked })}
              />
              إشعار بالنتائج
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost guardian-form-rows__add" onClick={onAdd}>
        <i className="fa-solid fa-plus" /> إضافة ولي آخر
      </button>
    </div>
  )
}
