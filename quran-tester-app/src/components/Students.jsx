import { useEffect, useState } from 'react'
import { students, getApiUrl } from '../api'

export default function Students({ onSelect, onProfile }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editNumber, setEditNumber] = useState(1)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editNaqza, setEditNaqza] = useState(20)

  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [dobAdd, setDobAdd] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  

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

  function toDateOnly(v){
    if (!v) return ''
    if (typeof v === 'string') {
      const m = v.match(/^\d{4}-\d{2}-\d{2}/)
      if (m) return m[0]
      if (v.includes('T')) return v.split('T')[0]
    }
    try {
      const d = new Date(v)
      if (!isNaN(d)) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth()+1).padStart(2,'0')
        const dd = String(d.getDate()).padStart(2,'0')
        return `${yyyy}-${mm}-${dd}`
      }
    } catch {}
    return ''
  }

  async function addStudent(e) {
    e.preventDefault()
    setError('')
    try {
      const { student: created } = await students.create({ number: Number(number), name: name.trim() })
      if (dobAdd) {
        const dateOnly = toDateOnly(dobAdd)
        if (dateOnly) await students.update(created.id, { date_of_birth: dateOnly })
      }
      if (photoFile) {
        // basic client validation to avoid stutter
        if (photoFile.size <= 2*1024*1024 && /^(image\/jpeg|image\/png)$/i.test(photoFile.type)) {
          await students.uploadPhoto(created.id, photoFile)
        }
      }
      if (photoPreview) { try { URL.revokeObjectURL(photoPreview) } catch {} }
      setNumber(''); setName(''); setDobAdd(''); setPhotoFile(null); setPhotoPreview('')
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditNumber(s.number || 1)
    setEditName(s.name || '')
    
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
      await students.update(editingId, { number: Number(editNumber), name: editName.trim(), current_naqza: Number(editNaqza) })
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

  const filtered = list.filter(s => {
    if (!query.trim()) return true
    const q = query.trim()
    return String(s.number).includes(q) || (s.name || '').includes(q)
  })
  const apiBase = getApiUrl()
  const placeholder = '/profile-placeholder.svg'
  const photoSrc = (s) => s?.photo_url ? (s.photo_url.startsWith('http') ? s.photo_url : `${apiBase}${s.photo_url}`) : placeholder

  return (
    <div className="container" style={{ width: '100%', maxWidth: 900 }}>
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
          <input className="input" placeholder="بحث بالاسم أو الرقم" value={query} onChange={e => setQuery(e.target.value)} />
          <button className="btn btn--primary" onClick={() => setShowAdd(v => !v)} type="button">{showAdd ? 'إخفاء' : 'إضافة طالب'}</button>
        </div>
        {showAdd && (
        <form onSubmit={addStudent} style={{ display:'grid', gridTemplateColumns:'1fr', gap:10, alignItems:'stretch', margin:'0 auto', width:'100%', maxWidth:520 }}>
          <label style={{ display:'grid', gap:6 }}>
            <span className="info-label">الرقم</span>
            <input className="input" type="number" value={number} onChange={e => setNumber(e.target.value)} required />
          </label>
          <label style={{ display:'grid', gap:6 }}>
            <span className="info-label">الاسم</span>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label style={{ display:'grid', gap:6 }}>
            <span className="info-label">تاريخ الميلاد</span>
            <input className="input" type="date" value={dobAdd} onChange={e => setDobAdd(e.target.value)} />
          </label>
          <div style={{ display:'grid', gap:6 }}>
            <span className="info-label">الصورة</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src={photoPreview || '/profile-placeholder.svg'} alt="معاينة" width={56} height={56} className="profile-photo" onError={(e)=>{ e.currentTarget.src='/profile-placeholder.svg' }} />
              <label className="btn" style={{ padding:'6px 10px' }}>
                اختيار صورة
                <input type="file" accept="image/jpeg,image/png" style={{ display:'none' }} onChange={(e)=>{ const f=e.target.files?.[0]; setPhotoFile(f||null); if (photoPreview) { try{ URL.revokeObjectURL(photoPreview) }catch{} } setPhotoPreview(f ? URL.createObjectURL(f) : '') }} />
              </label>
              <span className="meta">JPEG/PNG حتى 2MB</span>
            </div>
          </div>
          
          <button type="submit" className="btn btn--primary" style={{ gridColumn:'1/-1', justifySelf:'center' }}>إضافة</button>
        </form>
        )}
      </div>
      {error && <div style={{ color:'crimson', marginTop:8 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        {loading ? 'جاري التحميل…' : (
          <>
          <div className="desktop-only table-wrapper">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>الرقم</th>
                  <th>الاسم</th>
                  <th>النقزة الحالية</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className={editingId===s.id ? 'updated' : ''}>
                    <td>
                      <img className="profile-photo" src={photoSrc(s)} alt="صورة الطالب" width={48} height={48} onError={(e)=>{ if (e.currentTarget.dataset.fallback!== '1') { e.currentTarget.dataset.fallback='1'; e.currentTarget.src = '/profile-placeholder.svg' } }} />
                    </td>
                    <td>{editingId === s.id ? (
                      <input className="input" type="number" value={editNumber} onChange={e => setEditNumber(e.target.value)} />
                    ) : s.number}</td>
                    <td>{editingId === s.id ? (
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    ) : (
                      <span className="clickable" onClick={() => onProfile && onProfile(s)} title="عرض الملف">{s.name}</span>
                    )}</td>
                    
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
                          <button className="btn btn--primary" onClick={(e) => { e.stopPropagation(); onSelect(s) }} style={{ marginInlineEnd:6 }}>اختبار</button>
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
            {filtered.map(s => (
              <div key={s.id} className={`student-card ${editingId===s.id ? 'updated' : ''} clickable`} onClick={() => { if (!editingId) onProfile && onProfile(s) }} style={{ display:'grid', gap:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10, alignItems:'center' }}>
                  <div className="info-label" style={{ fontSize: 14 }}>الصورة</div>
                  <div>
                    <img className="profile-photo" src={photoSrc(s)} alt="صورة الطالب" width={56} height={56} onError={(e)=>{ if (e.currentTarget.dataset.fallback!== '1') { e.currentTarget.dataset.fallback='1'; e.currentTarget.src = placeholder } }} />
                  </div>
                  <div className="info-label" style={{ fontSize: 14 }}>الرقم</div>
                  <div>
                    {editingId === s.id ? (
                      <input className="input" type="number" min="1" max="30" value={editNumber} onChange={e => setEditNumber(e.target.value)} />
                    ) : (
                      <div className="info-value" style={{ textAlign:'start' }}>{s.number}</div>
                    )}
                  </div>
                  <div className="info-label" style={{ fontSize: 14 }}>الاسم</div>
                  <div>
                    {editingId === s.id ? (
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    ) : (
                      <div className="info-value clickable" onClick={() => onProfile && onProfile(s)} style={{ textAlign:'start', fontSize:18, fontWeight:700 }}>{s.name}</div>
                    )}
                  </div>
                  
                  <div className="info-label" style={{ fontSize: 14 }}>النقزة الحالية</div>
                  <div>
                    <select className="input" value={editingId === s.id ? editNaqza : s.current_naqza} onChange={e => setEditNaqza(Number(e.target.value))} disabled={editingId !== s.id}>
                      {Array.from({ length: 20 }, (_, i) => 20 - i).map(n => (
                        <option key={n} value={n}>{naqzaLabel(n)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="actions" onClick={(e)=>e.stopPropagation()} style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {editingId === s.id ? (
                    <>
                      <button className="icon-btn btn--primary" onClick={async () => { await saveEdit(); showToast('تم الحفظ') }} title="حفظ"><i className="fa-solid fa-check"></i></button>
                      <button className="icon-btn" onClick={cancelEdit} title="إلغاء"><i className="fa-solid fa-xmark"></i></button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn btn--primary" onClick={() => onSelect(s)} title="اختبار"><i className="fa-solid fa-play"></i></button>
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


