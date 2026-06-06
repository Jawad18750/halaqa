/** Options for crisp, scannable print QRs (32-char hex token). */
export const QR_PRINT_SPECS = {
  grid: { width: 512, margin: 4, errorCorrectionLevel: 'Q' },
  large: { width: 640, margin: 4, errorCorrectionLevel: 'Q' },
  single: { width: 800, margin: 4, errorCorrectionLevel: 'Q' },
}

/**
 * Print format catalogue.
 * Each format has one or more grid layouts the teacher can pick.
 *
 * scanEase: 1 (hardest) – 5 (easiest) for on-screen guidance only.
 */
export const QR_FORMATS = [
  {
    id: 'grid',
    label: 'ورقة A4 — شبكة',
    description: 'عدة ملصقات في الصفحة للقص واللصق على الدفاتر',
    icon: 'fa-solid fa-table-cells',
    tip: 'اختر شبكة أوسع إذا كان المسح صعبًا على الملصقات الصغيرة.',
    layouts: [
      { id: 'g5x4', cols: 5, rows: 4, label: 'كثيف',   subtitle: '٢٠ ملصق / صفحة', qrPx: 400, scanEase: 2 },
      { id: 'g4x3', cols: 4, rows: 3, label: 'قياسي',  subtitle: '١٢ ملصق / صفحة', qrPx: 480, scanEase: 3 },
      { id: 'g3x3', cols: 3, rows: 3, label: 'مريح',   subtitle: '٩ ملصقات / صفحة', qrPx: 520, scanEase: 4 },
      { id: 'g2x2', cols: 2, rows: 2, label: 'واسع',   subtitle: '٤ ملصقات / صفحة', qrPx: 640, scanEase: 5 },
    ],
  },
  {
    id: 'large',
    label: 'ملصقات كبيرة',
    description: 'ملصقات أكبر — الأسهل للمسح بالهاتف',
    icon: 'fa-solid fa-expand',
    tip: 'الأفضل للمسح السريع: اطبع بحجم 100% (بدون تصغير) والصق بعيدًا عن حافة الدفتر.',
    layouts: [
      { id: 'l3x3', cols: 3, rows: 3, label: 'قياسي',    subtitle: '٩ ملصقات / صفحة', qrPx: 600, scanEase: 5 },
      { id: 'l2x2', cols: 2, rows: 2, label: 'كبير جدًا', subtitle: '٤ ملصقات / صفحة', qrPx: 720, scanEase: 5 },
    ],
  },
  {
    id: 'single',
    label: 'طالب واحد',
    description: 'ملصق واحد لطالب محدد',
    icon: 'fa-solid fa-user',
    tip: 'مفيد عند إعادة طباعة ملصق مفقود أو لطالب جديد.',
    layouts: [
      { id: 's1x1', cols: 1, rows: 1, label: 'فردي', subtitle: 'ملصق واحد في الصفحة', qrPx: 800, scanEase: 5 },
    ],
  },
]

export function getQrFormat(id) {
  return QR_FORMATS.find(f => f.id === id) ?? QR_FORMATS[0]
}

export function getQrLayout(formatId, layoutId) {
  const format = getQrFormat(formatId)
  return format.layouts.find(l => l.id === layoutId) ?? format.layouts[0]
}

export function getQrSpecForLayout(layout) {
  return {
    width: layout.qrPx,
    margin: 4,
    errorCorrectionLevel: 'Q',
  }
}

/** Split a list into pages of `perPage` items. */
export function paginateItems(items, perPage) {
  if (!perPage || perPage < 1) return [items]
  const pages = []
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage))
  }
  return pages.length ? pages : [[]]
}

const TOKEN_RE = /^[a-f0-9]{32}$/i

/** Normalize raw ZXing output into a student qr_token. */
export function parseQrAttendanceToken(raw) {
  if (raw == null) return ''
  let text = String(raw)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

  if (!text) return ''

  // Some scanners append newline or control chars
  text = text.replace(/[\x00-\x1f\x7f]/g, '').trim()

  // URL wrapper (future-proof)
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      const fromQuery = url.searchParams.get('t')
        || url.searchParams.get('token')
        || url.searchParams.get('qr')
      if (fromQuery) text = fromQuery.trim()
      else {
        const parts = url.pathname.split('/').filter(Boolean)
        const last = parts[parts.length - 1]
        if (last && TOKEN_RE.test(last)) text = last
      }
    } catch {
      // keep original text
    }
  }

  if (text.toLowerCase().startsWith('halaqa:')) {
    text = text.slice(7).trim()
  }

  if (TOKEN_RE.test(text)) return text.toLowerCase()

  // Embedded token inside longer string
  const match = text.match(/[a-f0-9]{32}/i)
  return match ? match[0].toLowerCase() : text.toLowerCase()
}

export function isValidQrToken(token) {
  return TOKEN_RE.test(String(token || ''))
}
