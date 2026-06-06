/** Options for crisp, scannable print QRs (32-char hex token). */
export const QR_PRINT_SPECS = {
  grid: { width: 512, margin: 4, errorCorrectionLevel: 'Q' },
  large: { width: 640, margin: 4, errorCorrectionLevel: 'Q' },
  single: { width: 800, margin: 4, errorCorrectionLevel: 'Q' },
}

/** Who to include when printing. */
export const QR_STUDENT_SCOPES = [
  { id: 'all', label: 'كل الطلاب', icon: 'fa-solid fa-users' },
  { id: 'selected', label: 'طلاب محددون', icon: 'fa-solid fa-user-check' },
  { id: 'one', label: 'طالب واحد', icon: 'fa-solid fa-user' },
]

/** Sticker physical size (custom / sparse pages). */
export const QR_STICKER_SIZES = [
  { id: 'sm', label: 'صغير',     subtitle: '~٣٥ مم', qrPx: 400, maxMm: 35, scanEase: 3 },
  { id: 'md', label: 'متوسط',    subtitle: '~٥٠ مم', qrPx: 520, maxMm: 50, scanEase: 4 },
  { id: 'lg', label: 'كبير',     subtitle: '~٧٠ مم', qrPx: 640, maxMm: 70, scanEase: 5 },
  { id: 'xl', label: 'كبير جدًا', subtitle: '~٩٠ مم', qrPx: 800, maxMm: 90, scanEase: 5 },
]

/**
 * Print format catalogue.
 * Each format has one or more grid layouts the teacher can pick.
 *
 * scanEase: 1 (hardest) – 5 (easiest) for on-screen guidance only.
 * hasSizePicker: teacher picks sticker mm size (custom sparse pages).
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
    id: 'custom',
    label: 'طباعة مخصصة',
    description: 'طلاب محددون — اختر حجم الملصق وتوزيع الصفحة',
    icon: 'fa-solid fa-sliders',
    hasSizePicker: true,
    defaultScope: 'selected',
    tip: 'لإعادة طباعة ملصق مفقود: اختر «طالب واحد»، حجم الملصق، و«ملصق واحد / صفحة».',
    layouts: [
      { id: 'c1x1', cols: 1, rows: 1, label: 'واحد / صفحة', subtitle: 'ملصق في منتصف الورقة', qrPx: 520, scanEase: 5 },
      { id: 'c2x2', cols: 2, rows: 2, label: '٢×٢',         subtitle: '٤ ملصقات / صفحة',      qrPx: 520, scanEase: 5 },
      { id: 'c3x3', cols: 3, rows: 3, label: '٣×٣',         subtitle: '٩ ملصقات / صفحة',      qrPx: 520, scanEase: 4 },
    ],
  },
]

export function getQrFormat(id) {
  if (id === 'single') return getQrFormat('custom')
  return QR_FORMATS.find(f => f.id === id) ?? QR_FORMATS[0]
}

export function getQrLayout(formatId, layoutId) {
  const format = getQrFormat(formatId)
  return format.layouts.find(l => l.id === layoutId) ?? format.layouts[0]
}

export function getQrStickerSize(sizeId) {
  return QR_STICKER_SIZES.find(s => s.id === sizeId) ?? QR_STICKER_SIZES[1]
}

export function getQrCacheKey(layout, size, format) {
  if (format?.hasSizePicker && size) return `${layout.id}-${size.id}`
  return layout.id
}

export function getQrSpecForLayout(layout, size, format) {
  const qrPx = format?.hasSizePicker && size ? size.qrPx : layout.qrPx
  return {
    width: qrPx,
    margin: 4,
    errorCorrectionLevel: 'Q',
  }
}

/** CSS variables for sheet/sticker max width from chosen mm size. */
export function getQrSheetSizeVars(size) {
  if (!size) return {}
  const pct = Math.round((size.maxMm / 210) * 1000) / 10
  return {
    '--qr-sticker-max-mm': `${size.maxMm}mm`,
    '--qr-sticker-max-pct': `${pct}%`,
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
