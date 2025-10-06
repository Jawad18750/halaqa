import { useEffect, useMemo, useState } from 'react'
import { sessions, students, getApiUrl } from '../api'
import AvatarCropper from './AvatarCropper'

export default function StudentProfile({ student, onBack }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function toDateOnly(v) {
    if (!v) return ''
    if (typeof v === 'string') {
      const m = v.match(/^\d{4}-\d{2}-\d{2}/)
      if (m) return m[0]
      // e.g., 2013-12-26T22:00:00.000Z → 2013-12-26
      if (v.includes('T')) return v.split('T')[0]
    }
    try {
      const d = new Date(v)
      if (!isNaN(d)) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      }
    } catch {}
    return ''
  }

  const [dob, setDob] = useState(toDateOnly(student?.date_of_birth))
  useEffect(() => {
    setDob(toDateOnly(student?.date_of_birth))
  }, [student?.date_of_birth])
  const [photoUrl, setPhotoUrl] = useState(student?.photo_url || '')
  useEffect(() => {
    try {
      const ver = student?.updated_at ? new Date(student.updated_at).getTime() : Date.now()
      const base = student?.photo_url || ''
      if (base) setPhotoUrl(`${base}${base.includes('?') ? '&' : '?'}v=${ver}`)
    } catch {}
  }, [student?.photo_url, student?.updated_at])

  async function load() {
    setLoading(true); setError('')
    try {
      const { sessions: rows } = await sessions.forStudent(student.id)
      setList(rows)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [student?.id])

  async function saveDob() {
    try {
      let payloadDob = dob || null
      if (payloadDob && payloadDob.includes('/')) {
        // Convert dd/mm/yyyy → yyyy-mm-dd
        const [d, m, y] = payloadDob.split(/[\/.\-]/)
        if (d && m && y) payloadDob = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      } else if (payloadDob && payloadDob.includes('T')) {
        // Strip time if an ISO string slipped in
        payloadDob = payloadDob.split('T')[0]
      }
      await students.update(student.id, { date_of_birth: payloadDob })
    } catch (e) { setError(e.message) }
  }

  const [showCropper, setShowCropper] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  function onPick(e){
    const f = e.target.files?.[0]
    if (!f) return
    setPendingFile(f)
    setShowCropper(true)
  }
  async function onCropped(file){
    try {
      const { student: s } = await students.uploadPhoto(student.id, file)
      const ver = Date.now()
      setPhotoUrl(s.photo_url ? `${s.photo_url}?v=${ver}` : '')
      setShowCropper(false)
      setPendingFile(null)
    } catch (e) { setError(e.message) }
  }

  const apiBase = getApiUrl()
  const placeholder = '/profile-placeholder.svg'
  const photoSrc = photoUrl
    ? (photoUrl.startsWith('http') ? photoUrl : `${apiBase}${photoUrl}`)
    : placeholder

  function modeLabel(mode) {
    switch (mode) {
      case 'naqza': return 'النقزة'
      case 'juz': return 'الجزء'
      case 'five_hizb': return 'خمسة أحزاب'
      case 'quarter': return 'ربع القرآن'
      case 'half': return 'نصف القرآن'
      case 'full': return 'القرآن كامل'
      default: return mode || '—'
    }
  }

  function buildRows() {
    return list.map(r => ({
      date: new Date(r.attempt_at || r.created_at).toLocaleString('ar-EG-u-nu-latn'),
      thumun: String(r.thumun_id ?? ''),
      mode: modeLabel(r.mode),
      fatha: String(r.fatha_prompts ?? ''),
      taradud: String(r.taradud_count ?? ''),
      result: r.passed ? 'نجح' : 'فشل',
      score: String(r.score ?? '')
    }))
  }

  function exportExcel() {
    try {
      const rows = buildRows()
      const title = `سجل الطالب — ${student.name}`
      const styles = `
        table{border-collapse:collapse;width:100%;direction:rtl;font-family:'IBM Plex Sans Arabic',Arial}
        th,td{border:1px solid #ccd3db;padding:8px;text-align:center}
        thead th{background:#f3f6fa;font-weight:700}
        h1{font-size:18px;margin:0 0 10px}
      `
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>`
      html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><img src="/logo.svg" width="24" height="24" style="display:inline-block"/><h1 style="margin:0">${title}</h1></div>`
      html += `<div style="margin:6px 0 12px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center">
        <div style="display:flex;align-items:center;gap:10px"><img src="${photoSrc}" width="56" height="56" style="border-radius:10px;border:1px solid #ccd3db;object-fit:cover"/></div>
        <div style="display:grid;gap:4px">
          <div><strong>الاسم:</strong> ${student.name}</div>
          <div><strong>الرقم:</strong> ${student.number}</div>
          <div><strong>تاريخ الميلاد:</strong> ${dob || '—'}</div>
        </div>
      </div>`
      html += '<table><thead><tr>'+
        '<th>التاريخ</th><th>الثمن</th><th>الوضع</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th>'+
        '</tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${r.date}</td><td>${r.thumun}</td><td>${r.mode}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const blob = new Blob(["\ufeff" + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)
      a.href = url
      a.download = `student_${student.number}_attempts_${ts}.xls`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  function exportPDF() {
    try {
      const rows = buildRows()
      const title = `سجل الطالب — ${student.name} (رقم ${student.number})`
      const styles = `
        @page { size: A4; margin: 16mm }
        body{direction:rtl;font-family:'IBM Plex Sans Arabic',Arial;color:#111}
        h1{font-size:20px;margin:0;text-align:center}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccd3db;padding:6px 8px;text-align:center}
        thead th{background:#f3f6fa}
      `
      let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>`
      html += `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px"><img src="/logo.svg" width="26" height="26" style="display:inline-block"/><h1>${title}</h1></div>`
      html += `<div style="margin:6px 0 12px;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center">
        <div><img src="${photoSrc}" width="72" height="72" style="border-radius:12px;border:1px solid #ccd3db;object-fit:cover"/></div>
        <div style="display:grid;gap:6px">
          <div><strong>الاسم:</strong> ${student.name}</div>
          <div><strong>الرقم:</strong> ${student.number}</div>
          <div><strong>تاريخ الميلاد:</strong> ${dob || '—'}</div>
        </div>
      </div>`
      html += '<table><thead><tr>'+
        '<th>التاريخ</th><th>الثمن</th><th>الوضع</th><th>الفتحة</th><th>التردد</th><th>النتيجة</th><th>الدرجة</th>'+
        '</tr></thead><tbody>'
      for (const r of rows) {
        html += `<tr><td>${r.date}</td><td>${r.thumun}</td><td>${r.mode}</td><td>${r.fatha}</td><td>${r.taradud}</td><td>${r.result}</td><td>${r.score}</td></tr>`
      }
      html += '</tbody></table></body></html>'
      const win = window.open('', '_blank')
      if (!win) return setError('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.')
      win.document.open()
      win.document.write(html)
      win.document.close()
      // Small delay to ensure styles apply
      setTimeout(() => { win.focus(); win.print(); }, 250)
    } catch (e) {
      setError(String(e?.message || e))
    }
  }

  return (
    <div className="container" style={{ width:'100%', maxWidth: 900 }}>
      <button className="btn" onClick={onBack} style={{ marginBottom: 10 }}>← الرجوع</button>
      <div className="card profile-header" style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:12, alignItems:'center' }}>
        <div>
          <img className="profile-photo" src={photoSrc} alt="صورة الطالب" width={90} height={90}
               onError={() => setPhotoUrl('')}
          />
          <div style={{ marginTop:6 }}>
            <label className="btn" style={{ padding:'6px 10px', fontSize:12 }}>
              تحميل صورة
              <input type="file" accept="image/*" onChange={onPick} style={{ display:'none' }} />
            </label>
          </div>
        </div>
        <div style={{ display:'grid', gap:6, minWidth: 0 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{student.name}</div>
          <div className="tag">رقم الطالب: {student.number}</div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:8, alignItems:'center', minWidth: 0, paddingInline: 10 }}>
            <span className="info-label" style={{ whiteSpace:'nowrap' }}>تاريخ الميلاد:</span>
            <input className="input" type="date" value={dob || ''} onChange={e => setDob(e.target.value)} onBlur={saveDob} style={{ width:'100%', minWidth:0, paddingInline: 10 }} />
          </div>
        </div>
      </div>
      {showCropper && pendingFile && (
        <AvatarCropper file={pendingFile} onCancel={() => { setShowCropper(false); setPendingFile(null) }} onCropped={onCropped} />
      )}

      <div className="card profile-card" style={{ marginTop:12 }}>
        <h2 style={{ marginTop:0, color:'var(--muted)' }}>سجل الطالب</h2>
        {error && <div style={{ color:'crimson', marginBottom:8 }}>{error}</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:8 }}>
          <button className="btn" onClick={exportPDF} title="تصدير PDF">تصدير PDF</button>
          <button className="btn" onClick={exportExcel} title="تصدير Excel">تصدير Excel</button>
        </div>
        {loading ? 'جاري التحميل…' : (
          <div className="profile-table-wrapper">
            <table className="responsive-table profile-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الثمن</th>
                  <th>الوضع</th>
                  <th>الفتحة</th>
                  <th>التردد</th>
                  <th>النتيجة</th>
                  <th>الدرجة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id}>
                    <td>
                      <EditableTime row={r} onSaved={load} onError={setError} />
                    </td>
                    <td>{r.thumun_id}</td>
                    <td>{modeLabel(r.mode)}</td>
                    <td>{r.fatha_prompts}</td>
                    <td>{r.taradud_count}</td>
                    <td>{r.passed ? 'نجح' : 'فشل'}</td>
                    <td>{r.score}</td>
                    <td>
                      <button className="icon-btn" title="حذف" onClick={async () => { try { if (!confirm('حذف المحاولة؟')) return; await sessions.remove(r.id); load() } catch(e){ setError(String(e.message||e)) } }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function EditableTime({ row, onSaved, onError }){
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(toLocalInput(row.attempt_at || row.created_at))
  function toLocalInput(iso){
    try { const d = new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) } catch { return '' }
  }
  function toIsoLocal(input){
    // input is yyyy-MM-ddTHH:mm (local). Convert to ISO string preserving local wall time
    try { const d = new Date(input); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString() } catch { return null }
  }
  async function save(){
    try {
      const iso = toIsoLocal(val)
      if (!iso) return onError('تاريخ غير صالح')
      await sessions.updateTime(row.id, iso)
      setEditing(false)
      onSaved?.()
    } catch (e) { onError(String(e?.message||e)) }
  }
  if (!editing) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <span>{new Date(row.attempt_at || row.created_at).toLocaleString('ar-LY')}</span>
      <button className="icon-btn" title="تعديل الوقت" onClick={()=>setEditing(true)}><i className="fa-solid fa-pen"></i></button>
    </div>
  )
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <input type="datetime-local" className="input" value={val} onChange={e=>setVal(e.target.value)} style={{ width: 220 }} />
      <button className="icon-btn btn--primary" title="حفظ" onClick={save}><i className="fa-solid fa-check"></i></button>
      <button className="icon-btn" title="إلغاء" onClick={()=>{ setEditing(false); setVal(toLocalInput(row.attempt_at || row.created_at)) }}><i className="fa-solid fa-xmark"></i></button>
    </div>
  )
}


