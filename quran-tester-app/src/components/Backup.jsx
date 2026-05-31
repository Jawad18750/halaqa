import { useState } from 'react'
import { backup } from '../api'
import PageHeader from './ui/PageHeader.jsx'
import SectionCard from './ui/SectionCard.jsx'
import StatTile from './ui/StatTile.jsx'
import { confirmDialog } from './ui/ConfirmDialog.jsx'

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
            photos: json.photos ? Object.keys(json.photos).length : 0,
          },
          raw: json,
        })
        setError('')
      } catch {
        setInfo(null)
        setError('تعذر قراءة الملف، تأكد أنه JSON صالح')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!info?.raw) { setError('اختر ملف نسخة احتياطية أولاً'); return }
    const ok = await confirmDialog('استيراد النسخة', 'هل تريد استيراد النسخة الاحتياطية؟ لن يتم حذف بياناتك الحالية.')
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
    <div className="stack">
      <PageHeader title="النسخ الاحتياطي" subtitle="تصدير واستيراد بيانات الحلقة" onBack={onBack} />

      <SectionCard title="تنزيل نسخة احتياطية">
        <p className="meta">ملف JSON يحتوي على الطلاب، الجلسات، والصور (Base64).</p>
        <button type="button" className="btn btn--primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'جاري التحضير…' : 'تنزيل النسخة الاحتياطية'}
        </button>
      </SectionCard>

      <SectionCard title="استيراد نسخة احتياطية">
        <p className="meta">سيتم دمج البيانات دون حذف السجلات الحالية.</p>
        <label className="btn">
          اختيار ملف JSON
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onFileSelect} />
        </label>
        {fileName && <div className="meta">الملف: {fileName}</div>}
        {info && (
          <div className="stat-grid stat-grid--fit" style={{ marginTop: 12 }}>
            <StatTile label="الإصدار" value={info.version || '—'} />
            <StatTile label="طلاب" value={info.counts.students ?? 0} />
            <StatTile label="جلسات" value={info.counts.sessions ?? 0} />
            <StatTile label="صور" value={info.counts.photos ?? 0} />
          </div>
        )}
        <button type="button" className="btn btn--primary" style={{ marginTop: 12 }} onClick={handleImport} disabled={importing || !info}>
          {importing ? 'جاري الاستيراد…' : 'استيراد النسخة'}
        </button>
        {result && (
          <div className="stat-grid stat-grid--fit" style={{ marginTop: 12 }}>
            <StatTile label="طلاب مُضافة" value={result?.stats?.students?.inserted ?? 0} />
            <StatTile label="طلاب محدّثة" value={result?.stats?.students?.updated ?? 0} />
            <StatTile label="جلسات مُضافة" value={result?.stats?.sessions?.inserted ?? 0} />
            <StatTile label="صور مُستعادة" value={result?.stats?.photos?.saved ?? 0} />
          </div>
        )}
        {error && <div className="alert alert--error" style={{ marginTop: 12 }}>{error}</div>}
      </SectionCard>
    </div>
  )
}
