import { useEffect, useState } from 'react'
import { students } from '../api'

export default function Students({ onSelect }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editNumber, setEditNumber] = useState(1)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editNaqza, setEditNaqza] = useState(20)

  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { students: s } = await students.list()
      setList(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function addStudent(e) {
    e.preventDefault()
    setError('')
    try {
      await students.create({ number: Number(number), name: name.trim(), notes: notes.trim() })
      setNumber(''); setName(''); setNotes('')
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditNumber(s.number || 1)
    setEditName(s.name || '')
    setEditNotes(s.notes || '')
    setEditNaqza(s.current_naqza || 20)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setError('')
    try {
      const ok = await confirmModal('تأكيد الحفظ', 'هل تريد حفظ تعديلات الطالب؟')
      if (!ok) return
      await students.update(editingId, { number: Number(editNumber), name: editName.trim(), notes: editNotes.trim(), current_naqza: Number(editNaqza) })
      setEditingId(null)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  // toast state
  const [toast, setToast] = useState('')
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // build naqza label from thumuns list
  const [thumuns, setThumuns] = useState([])
  useEffect(() => {
    fetch('/quran-thumun-data.json').then(r => r.json()).then(d => setThumuns(d.thumuns || [])).catch(() => {})
  }, [])
  function naqzaLabel(n) {
    if (!n || !thumuns.length) return String(n || '')
    const first = thumuns.filter(t => t.naqza === Number(n)).sort((a,b)=>a.id-b.id)[0]
    return first && first.name ? `${n} - ${first.name}` : String(n)
  }

  return (
    <div style={{ padding: 16, width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ textAlign:'center', marginBottom: 12 }}>الطلاب</h2>
      <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}>
        <button className="btn btn--primary" onClick={() => setShowAdd(v => !v)} type="button">{showAdd ? 'إخفاء' : 'إضافة طالب'}</button>
      </div>
      {showAdd && (
      <form onSubmit={addStudent} style={{ display:'grid', gridTemplateColumns:'1fr', gap:10, alignItems:'stretch', margin:'0 auto 12px', maxWidth:480 }}>
        <label style={{ display:'grid', gap:6 }}>
          <span className="info-label">الرقم</span>
          <input className="input" type="number" min="1" max="30" value={number} onChange={e => setNumber(e.target.value)} required />
        </label>
        <label style={{ display:'grid', gap:6 }}>
          <span className="info-label">الاسم</span>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label style={{ display:'grid', gap:6 }}>
          <span className="info-label">ملاحظات</span>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary" style={{ gridColumn:'1/-1', justifySelf:'center' }}>إضافة</button>
      </form>
      )}
      {error && <div style={{ color:'crimson', marginTop:8 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        {loading ? 'جاري التحميل…' : (
          <>
          <div className="desktop-only table-wrapper">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>الاسم</th>
                  <th>ملاحظات</th>
                  <th>النقزة الحالية</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map(s => (
                  <tr key={s.id} className={editingId===s.id ? 'updated' : ''}>
                    <td>{editingId === s.id ? (
                      <input className="input" type="number" min="1" max="30" value={editNumber} onChange={e => setEditNumber(e.target.value)} />
                    ) : s.number}</td>
                    <td>{editingId === s.id ? (
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    ) : s.name}</td>
                    <td>{editingId === s.id ? (
                      <input className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                    ) : (s.notes || '—')}</td>
                    <td>
                      <select className="input" value={editingId === s.id ? editNaqza : s.current_naqza} onChange={e => setEditNaqza(Number(e.target.value))} disabled={editingId !== s.id} style={{ maxWidth:260 }}>
                        {Array.from({ length: 20 }, (_, i) => 20 - i).map(n => (
                          <option key={n} value={n}>{naqzaLabel(n)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {editingId === s.id ? (
                        <>
                          <button className="icon-btn btn--primary" onClick={async () => { await saveEdit(); showToast('تم الحفظ') }} style={{ marginInlineEnd:6 }} title="حفظ">
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button className="icon-btn" onClick={cancelEdit} title="إلغاء">
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="tag clickable" onClick={() => onSelect(s)} style={{ marginInlineEnd:6 }}>اختبار</span>
                          <button className="icon-btn" onClick={() => startEdit(s)} title="تعديل" style={{ marginInlineEnd:6 }}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button className="icon-btn" onClick={async () => { try { const ok = await confirmModal('تأكيد الحذف','هل تريد حذف الطالب؟'); if (!ok) return; await students.remove(s.id); showToast('تم الحذف'); load() } catch(e){ setError(String(e.message||e)) } }} title="حذف">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-cards">
            {list.map(s => (
              <div key={s.id} className={`student-card ${editingId===s.id ? 'updated' : ''}`} style={{ display:'grid', gap:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:8 }}>
                  <div className="info-label">الرقم</div>
                  <div>
                    {editingId === s.id ? (
                      <input className="input" type="number" min="1" max="30" value={editNumber} onChange={e => setEditNumber(e.target.value)} />
                    ) : (
                      <div className="info-value" style={{ textAlign:'start' }}>{s.number}</div>
                    )}
                  </div>
                  <div className="info-label">الاسم</div>
                  <div>
                    {editingId === s.id ? (
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    ) : (
                      <div className="info-value" style={{ textAlign:'start' }}>{s.name}</div>
                    )}
                  </div>
                  <div className="info-label">ملاحظات</div>
                  <div>
                    {editingId === s.id ? (
                      <input className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                    ) : (
                      <div className="info-value" style={{ textAlign:'start' }}>{s.notes || '—'}</div>
                    )}
                  </div>
                  <div className="info-label">النقزة الحالية</div>
                  <div>
                    <select className="input" value={editingId === s.id ? editNaqza : s.current_naqza} onChange={e => setEditNaqza(Number(e.target.value))} disabled={editingId !== s.id}>
                      {Array.from({ length: 20 }, (_, i) => 20 - i).map(n => (
                        <option key={n} value={n}>{naqzaLabel(n)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="actions">
                  {editingId === s.id ? (
                    <>
                      <button className="icon-btn btn--primary" onClick={async () => { await saveEdit(); showToast('تم الحفظ') }} title="حفظ"><i className="fa-solid fa-check"></i></button>
                      <button className="icon-btn" onClick={cancelEdit} title="إلغاء"><i className="fa-solid fa-xmark"></i></button>
                    </>
                  ) : (
                    <>
                      <span className="tag clickable" onClick={() => onSelect(s)}>اختبار</span>
                      <button className="icon-btn" onClick={() => startEdit(s)} title="تعديل"><i className="fa-solid fa-pen"></i></button>
                      <button className="icon-btn" onClick={async () => { try { const ok = await confirmModal('تأكيد الحذف','هل تريد حذف الطالب؟'); if (!ok) return; await students.remove(s.id); showToast('تم الحذف'); load() } catch(e){ setError(String(e.message||e)) } }} title="حذف"><i className="fa-solid fa-trash"></i></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      <ConfirmModal />
    </div>
  )
}

// Simple confirm modal using local state in module scope
let confirmState = { open: false, title: '', message: '', resolve: (v) => {} }
function confirmModal(title, message) {
  confirmState.open = true; confirmState.title = title; confirmState.message = message
  return new Promise((resolve) => { confirmState.resolve = resolve; window.dispatchEvent(new Event('confirm-modal-change')) })
}
function ConfirmModal() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const h = () => setTick(t => t + 1)
    window.addEventListener('confirm-modal-change', h)
    return () => window.removeEventListener('confirm-modal-change', h)
  }, [])
  if (!confirmState.open) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 style={{ marginTop:0 }}>{confirmState.title}</h3>
        <div style={{ color:'var(--muted)' }}>{confirmState.message}</div>
        <div className="actions">
          <button className="btn" onClick={() => { confirmState.open = false; confirmState.resolve(false); window.dispatchEvent(new Event('confirm-modal-change')) }}>إلغاء</button>
          <button className="btn btn--primary" onClick={() => { confirmState.open = false; confirmState.resolve(true); window.dispatchEvent(new Event('confirm-modal-change')) }}>تأكيد</button>
        </div>
      </div>
    </div>
  )
}


