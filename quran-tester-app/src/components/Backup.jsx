import { useState } from 'react'
import { backup } from '../api'

export default function Backup({ onBack }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')

  async function handleExport() {
    setError(''); setResult(null)
    try {
      setExporting(true)
      const { blob, filename } = await backup.exportWithPhotos()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  function onFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result)
        setInfo({
          version: json.version,
          counts: json.counts || {
            students: json.students?.length || 0,
            sessions: json.sessions?.length || 0,
            photos: json.photos ? Object.keys(json.photos).length : 0
          },
          raw: json
        })
        setError('')
      } catch (err) {
        setInfo(null)
        setError('تعذر قراءة الملف، تأكد أنه JSON صالح')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!info?.raw) {
      setError('اختر ملف نسخة احتياطية أولاً')
      return
    }
    const ok = window.confirm('هل تريد استيراد النسخة الاحتياطية الآن؟ لن يتم حذف بياناتك الحالية.')
    if (!ok) return
    setError(''); setResult(null)
    try {
      setImporting(true)
      const res = await backup.importBackup(info.raw)
      setResult(res)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ padding: 16, width:'100%', maxWidth: 760, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
        <button className="btn" onClick={onBack}>← الرجوع</button>
      </div>
      <h2 style={{ textAlign:'center', marginTop:0 }}>النسخ الاحتياطي</h2>

      <div className="card" style={{ display:'grid', gap:8, marginBottom:12 }}>
        <h3 style={{ margin:'0 0 4px' }}>تنزيل نسخة احتياطية (تشمل الصور)</h3>
        <p style={{ margin:0, color:'var(--muted)' }}>سيتم تنزيل ملف JSON يحتوي على الطلاب، الجلسات، والصور (Base64).</p>
        <button className="btn btn--primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'جاري التحضير…' : 'تنزيل النسخة الاحتياطية'}
        </button>
      </div>

      <div className="card" style={{ display:'grid', gap:8 }}>
        <h3 style={{ margin:'0 0 4px' }}>استيراد نسخة احتياطية</h3>
        <p style={{ margin:0, color:'var(--muted)' }}>لن يتم حذف بياناتك الحالية؛ سيتم دمج البيانات وإضافة أي سجلات جديدة. الصور سيتم استعادتها إن وجدت.</p>
        <label className="btn" style={{ justifySelf:'start' }}>
          اختيار ملف JSON
          <input type="file" accept=".json,application/json" style={{ display:'none' }} onChange={onFileSelect} />
        </label>
        {fileName && <div className="meta">الملف المختار: {fileName}</div>}
        {info && (
          <div className="info-grid">
            <Info label="الإصدار" value={info.version || 'غير محدد'} />
            <Info label="عدد الطلاب" value={info.counts.students ?? 0} />
            <Info label="عدد الجلسات" value={info.counts.sessions ?? 0} />
            <Info label="صور مرفقة" value={info.counts.photos ?? 0} />
          </div>
        )}
        <button className="btn btn--primary" onClick={handleImport} disabled={importing || !info}>
          {importing ? 'جاري الاستيراد…' : 'استيراد النسخة'}
        </button>
        {result && (
          <div className="info-grid">
            <Info label="طلاب مُضافة" value={result?.stats?.students?.inserted ?? 0} />
            <Info label="طلاب محدّثة" value={result?.stats?.students?.updated ?? 0} />
            <Info label="جلسات مُضافة" value={result?.stats?.sessions?.inserted ?? 0} />
            <Info label="جلسات محدّثة" value={result?.stats?.sessions?.updated ?? 0} />
            <Info label="صور مُستعادة" value={result?.stats?.photos?.saved ?? 0} />
          </div>
        )}
        {error && <div style={{ color:'crimson' }}>{error}</div>}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="info">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  )
}

