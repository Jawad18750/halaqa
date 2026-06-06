/** Options for crisp, scannable print QRs (32-char hex token). */
export const QR_PRINT_SPECS = {
  grid: { width: 512, margin: 4, errorCorrectionLevel: 'Q' },
  large: { width: 640, margin: 4, errorCorrectionLevel: 'Q' },
  single: { width: 800, margin: 4, errorCorrectionLevel: 'Q' },
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
