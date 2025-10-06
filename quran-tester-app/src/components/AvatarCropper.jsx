import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'

export default function AvatarCropper({ file, onCancel, onCropped }) {
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [previewSrc, setPreviewSrc] = useState('')
  const [scale, setScale] = useState({ x: 1, y: 1 }) // original / preview ratios

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function readImage(fileObj){
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(fileObj)
    })
  }

  // Generate a downscaled preview once for smoother panning on mobile
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const src = await readImage(file)
        const img = await new Promise((resolve, reject) => {
          const i = new Image()
          i.onload = () => resolve(i)
          i.onerror = reject
          i.src = src
        })
        const maxSide = 1024 // keeps memory small and interactions smooth
        const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        const targetW = Math.max(1, Math.round(img.naturalWidth * ratio))
        const targetH = Math.max(1, Math.round(img.naturalHeight * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, targetW, targetH)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        if (!cancelled) {
          setPreviewSrc(dataUrl)
          setScale({ x: img.naturalWidth / targetW, y: img.naturalHeight / targetH })
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [file])

  async function exportCanvas() {
    const imageSrc = await readImage(file)
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = imageSrc
    })
    const canvas = document.createElement('canvas')
    const size = 512
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    // Map cropped area (measured on preview) back to original using stored ratios
    const scaleX = scale.x
    const scaleY = scale.y
    const sx = Math.round(croppedAreaPixels.x * scaleX)
    const sy = Math.round(croppedAreaPixels.y * scaleY)
    const sw = Math.round(croppedAreaPixels.width * scaleX)
    const sh = Math.round(croppedAreaPixels.height * scaleY)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, size, size)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    const outFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    onCropped(outFile)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal" style={{ width: 'min(520px, 92vw)' }}>
        <h3 style={{ marginTop: 0 }}>قص الصورة</h3>
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#111', borderRadius: 12, overflow: 'hidden', willChange: 'transform' }}>
          <Cropper
            image={previewSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition
            zoomWithScroll
            minZoom={1}
            maxZoom={3}
            showGrid={false}
          />
        </div>
        <div className="actions" style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          <button className="btn" onClick={onCancel}>إلغاء</button>
          <button className="btn btn--primary" onClick={exportCanvas}>حفظ</button>
        </div>
      </div>
    </div>
  )
}
