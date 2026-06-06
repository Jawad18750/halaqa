import jsQR from 'jsqr'
import { BrowserQRCodeReader } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

const SCAN_INTERVAL_MS = 50

/**
 * Output canvas size for all cropped regions.
 * Keeping it at 800px is a good trade-off between resolution and
 * the cost of getImageData on a mobile device.
 */
const CROP_OUT_PX = 800

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function waitForVideoFrames(video, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
    ) return true
    await new Promise(r => setTimeout(r, 40))
  }
  return false
}

async function createBarcodeDetector() {
  if (typeof BarcodeDetector === 'undefined') return null
  try {
    const supported = await BarcodeDetector.getSupportedFormats?.()
    if (supported && !supported.includes('qr_code')) return null
    return new BarcodeDetector({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

/**
 * Return a binarized (black/white) copy of an ImageData.
 * Helps jsQR decode slightly blurry or low-contrast camera frames.
 * We use the global-mean luma as adaptive threshold so it works in
 * both bright and dim lighting.
 */
function binarize(imageData) {
  const src = imageData.data
  const out = new Uint8ClampedArray(src.length)
  let sum = 0
  const n = src.length >>> 2
  for (let i = 0; i < src.length; i += 4) {
    sum += (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >>> 8
  }
  // Threshold: half-way between black and the mean – works well for
  // printed QR codes (mostly white background) in varied lighting.
  const threshold = Math.max(80, Math.min(220, Math.round(sum / n * 0.7)))
  for (let i = 0; i < src.length; i += 4) {
    const luma = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >>> 8
    const v = luma < threshold ? 0 : 255
    out[i] = out[i + 1] = out[i + 2] = v
    out[i + 3] = 255
  }
  return new ImageData(out, imageData.width, imageData.height)
}

function jsqrDecode(imageData) {
  return jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })?.data ?? null
}

function zxingDecode(canvas, reader) {
  if (!reader) return null
  try {
    return reader.decodeFromCanvas(canvas)?.getText?.() ?? null
  } catch {
    return null
  }
}

// ─── Canvas capture ───────────────────────────────────────────────────────────

/**
 * Draw a center-crop of `video` onto `canvas`.
 *
 * @param {HTMLVideoElement}  video
 * @param {HTMLCanvasElement} canvas
 * @param {number} frac   fraction of shorter dimension to use as crop side (0–1)
 * @param {number} outPx  desired output canvas side in pixels
 * @returns {boolean}
 */
function cropToCanvas(video, canvas, frac, outPx) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  if (frac >= 0.99) {
    canvas.width = vw
    canvas.height = vh
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(video, 0, 0, vw, vh)
    return true
  }

  const side = Math.floor(Math.min(vw, vh) * frac)
  const sx = Math.floor((vw - side) / 2)
  const sy = Math.floor((vh - side) / 2)

  canvas.width = outPx
  canvas.height = outPx

  // Nearest-neighbour when upscaling (keeps QR module edges sharp).
  // Bilinear when downscaling (avoids aliasing).
  ctx.imageSmoothingEnabled = side > outPx
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, sx, sy, side, side, 0, 0, outPx, outPx)
  return true
}

/**
 * Try jsQR on a canvas, first on the raw frame, then on a binarized copy.
 */
function jsqrOnCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const raw = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsqrDecode(raw) ?? jsqrDecode(binarize(raw))
}

// ─── Main per-frame detection ─────────────────────────────────────────────────

/**
 * Run one detection pass on the current video frame.
 *
 * Detection order (fastest/best first):
 *  1. Native BarcodeDetector on full video frame
 *  2. Native BarcodeDetector on cropped ImageBitmaps (70 %, 40 %, 22 %)
 *     ↳ This mirrors exactly what native Android QR apps do: zoom in and re-run
 *       the same OS engine on the cropped area. This is the primary fix for
 *       small printed sticker QR codes.
 *  3. jsQR on center crops (22 % → 40 % → 65 % → full) with binarization
 *  4. ZXing on 40 % and full-frame canvases (last resort)
 */
async function detectFromVideoFrame(video, canvas, zxingReader, barcodeDetector) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null

  // ── 1 & 2: Native BarcodeDetector ─────────────────────────────────────────
  if (barcodeDetector) {
    // 1. Full frame (fast path; works for large/screen QRs)
    try {
      const codes = await barcodeDetector.detect(video)
      const val = codes?.find(c => c.rawValue)?.rawValue
      if (val) return val
    } catch { /* fall through */ }

    // 2. Cropped ImageBitmaps fed back to BarcodeDetector.
    //    Small sticker QR that occupies ~5-15 % of the full frame becomes
    //    the dominant feature in a tight crop — exactly like how the native
    //    Android camera app zooms in on QR codes before decoding.
    for (const frac of [0.70, 0.40, 0.22]) {
      const side = Math.floor(Math.min(vw, vh) * frac)
      const sx = Math.floor((vw - side) / 2)
      const sy = Math.floor((vh - side) / 2)
      try {
        const bmp = await createImageBitmap(video, sx, sy, side, side)
        const codes = await barcodeDetector.detect(bmp)
        bmp.close()
        const val = codes?.find(c => c.rawValue)?.rawValue
        if (val) return val
      } catch { /* createImageBitmap or detect threw – fall through */ }
    }
  }

  // ── 3: jsQR on progressively wider crops ──────────────────────────────────
  // Tight crops first so the common case (teacher aims at sticker) is fast.
  for (const frac of [0.22, 0.40, 0.65, 1.00]) {
    if (!cropToCanvas(video, canvas, frac, CROP_OUT_PX)) continue
    const val = jsqrOnCanvas(canvas)
    if (val) return val
  }

  // ── 4: ZXing fallback ─────────────────────────────────────────────────────
  for (const frac of [0.40, 1.00]) {
    if (!cropToCanvas(video, canvas, frac, CROP_OUT_PX)) continue
    const val = zxingDecode(canvas, zxingReader)
    if (val) return val
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a live QR scanner on `video`.
 *
 * Returns an object with `{ stop(), getEngine() }`.
 */
export function startAttendanceScanner({ video, onDetect, onStreamReady, onError }) {
  let active = true
  let stream = null
  let timer = null
  const canvas = document.createElement('canvas')
  let zxingReader = null
  let barcodeDetector = null
  let inFlight = false
  let engine = 'initializing'

  const hints = new Map()
  hints.set(DecodeHintType.TRY_HARDER, true)
  zxingReader = new BrowserQRCodeReader(hints)

  async function scanFrame() {
    if (!active || inFlight) return
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return
    inFlight = true
    try {
      const value = await detectFromVideoFrame(video, canvas, zxingReader, barcodeDetector)
      if (value && active) onDetect(value)
    } catch {
      // ignore per-frame errors – don't crash the scan loop
    } finally {
      inFlight = false
    }
  }

  function scheduleScan() {
    if (!active) return
    timer = window.setTimeout(async () => {
      await scanFrame()
      scheduleScan()
    }, SCAN_INTERVAL_MS)
  }

  async function init() {
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720  },
      },
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints)

    // Request continuous autofocus if the track supports it.
    // This prevents the camera locking focus at the wrong distance
    // when the phone is moved close to a small sticker.
    const track = stream.getVideoTracks()[0]
    if (track) {
      try {
        const caps = track.getCapabilities?.()
        if (caps?.focusMode?.includes?.('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
        }
      } catch { /* focus API not supported on this device */ }
    }

    video.playsInline = true
    video.muted = true
    video.autoplay = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.srcObject = stream
    await video.play()

    const ready = await waitForVideoFrames(video)
    if (!ready) throw new Error('تعذر تجهيز الكاميرا')

    onStreamReady?.(stream)

    barcodeDetector = await createBarcodeDetector()
    engine = barcodeDetector ? 'barcode-detector' : 'jsqr-zxing'

    scheduleScan()
  }

  init().catch(err => {
    if (active) onError?.(err)
  })

  return {
    getEngine: () => engine,
    stop: () => {
      active = false
      if (timer) clearTimeout(timer)
      timer = null
      barcodeDetector = null
      stream?.getTracks?.().forEach(t => t.stop())
      stream = null
      if (video) video.srcObject = null
    },
  }
}

/** Decode a still image chosen from the photo picker. */
export async function decodeQrFromImageFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const detector = await createBarcodeDetector()

    if (detector) {
      try {
        const codes = await detector.detect(img)
        const val = codes?.find(c => c.rawValue)?.rawValue
        if (val) return val
      } catch { /* fall through */ }
    }

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)

    const raw = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const jsVal = jsqrDecode(raw) ?? jsqrDecode(binarize(raw))
    if (jsVal) return jsVal

    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    return zxingDecode(canvas, new BrowserQRCodeReader(hints))
  } finally {
    URL.revokeObjectURL(url)
  }
}
