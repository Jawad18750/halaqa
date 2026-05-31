function naqzaShort(n) {
  const num = Number(n)
  return num ? `نقزة ${num}` : '—'
}

export default function StudentListItem({
  student,
  photoSrc,
  placeholder,
  naqzaLabels,
  testedThisWeek,
  editing,
  editNumber,
  editName,
  editNaqza,
  onEditNumber,
  onEditName,
  onEditNaqza,
  onSave,
  onCancelEdit,
  onProfile,
  onTest,
  onStartEdit,
  onDelete,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  missingGuardian = false,
}) {
  const naqzaDisplay = (n) => {
    const num = Number(n)
    if (!num) return '—'
    const name = naqzaLabels[num - 1]
    return name ? `${num} — ${name}` : String(num)
  }

  if (editing) {
    return (
      <li className="student-item student-item--editing">
        <div className="student-item__form">
          <label className="field">
            <span className="field__label">الرقم</span>
            <input className="input" type="number" value={editNumber} onChange={e => onEditNumber(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">الاسم</span>
            <input className="input" value={editName} onChange={e => onEditName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">النقزة</span>
            <select className="input" value={editNaqza} onChange={e => onEditNaqza(Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => 20 - i).map(n => (
                <option key={n} value={n}>{naqzaDisplay(n)}</option>
              ))}
            </select>
          </label>
          <div className="student-item__form-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={onSave}>حفظ</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCancelEdit}>إلغاء</button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="student-item">
      <button type="button" className="student-item__tap" onClick={() => onProfile(student)}>
        <span className="student-item__number" aria-label={`رقم ${student.number}`}>
          {student.number}
        </span>
        <span className="student-item__avatar-wrap">
          <img
            className="student-item__avatar"
            src={photoSrc(student)}
            alt=""
            width={36}
            height={36}
            onError={(e) => { e.currentTarget.src = placeholder }}
          />
          <span
            className={`student-item__status ${testedThisWeek ? 'student-item__status--done' : 'student-item__status--pending'}`}
            title={testedThisWeek ? 'اختُبر هذا الأسبوع' : 'لم يُختبر هذا الأسبوع'}
            aria-hidden
          />
        </span>
        <div className="student-item__info">
          <p className="student-item__name">{student.name}</p>
          <p className="student-item__meta">
            <span className="student-item__naqza">{naqzaShort(student.current_naqza)}</span>
            {missingGuardian && (
              <span className="student-item__status-label student-item__status-label--guardian">بدون ولي أمر</span>
            )}
            {testedThisWeek && (
              <span className="student-item__status-label student-item__status-label--done">مُختبر</span>
            )}
          </p>
        </div>
      </button>
      <div className="student-item__actions">
        <button
          type="button"
          className="student-item__test"
          aria-label={`اختبار ${student.name}`}
          onClick={() => onTest(student)}
        >
          <span className="student-item__test-glyph" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="student-item__menu-btn"
          aria-label="المزيد"
          aria-expanded={menuOpen}
          onClick={(e) => { e.stopPropagation(); onMenuToggle() }}
        >
          <i className="fa-solid fa-ellipsis-vertical" />
        </button>
      </div>
      {menuOpen && (
        <div className="student-item__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { onMenuClose(); onProfile(student) }}>
            <i className="fa-solid fa-user" /> الملف
          </button>
          <button type="button" role="menuitem" onClick={() => { onMenuClose(); onStartEdit(student) }}>
            <i className="fa-solid fa-pen" /> تعديل
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => { onMenuClose(); onDelete(student) }}>
            <i className="fa-solid fa-trash" /> حذف
          </button>
        </div>
      )}
    </li>
  )
}
