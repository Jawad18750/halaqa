const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

export function joinMessageBlocks(blocks) {
  return blocks
    .map(block => {
      if (Array.isArray(block)) return block.filter(Boolean).join('\n').trim()
      return String(block || '').trim()
    })
    .filter(Boolean)
    .join('\n\n')
}

export function buildHalaqaSignature({ sheikhName, masjidName, style = 'footer' } = {}) {
  const sheikh = String(sheikhName || '').trim()
  const masjid = String(masjidName || '').trim()
  if (!sheikh && !masjid) return null

  if (style === 'plain') {
    if (masjid && sheikh) return `*${masjid}*\n*الشيخ:* ${sheikh}`
    if (masjid) return `*${masjid}*`
    return `*الشيخ:* ${sheikh}`
  }

  if (style === 'footer') {
    const lines = []
    if (masjid) lines.push(`🕌 ${masjid}`)
    if (sheikh) lines.push(`الشيخ: ${sheikh}`)
    return lines.join('\n')
  }

  if (masjid && sheikh) return `🕌 ${masjid} — بإشراف الشيخ ${sheikh}`
  if (masjid) return `🕌 ${masjid}`
  if (sheikh) return `📖 حلقة القرآن الكريم — بإشراف الشيخ ${sheikh}`
  return '📖 حلقة القرآن الكريم'
}

export function buildHalaqaIntro({ sheikhName, masjidName, style = 'emoji' } = {}) {
  if (style === 'plain') {
    const sheikh = String(sheikhName || '').trim()
    const masjid = String(masjidName || '').trim()
    if (masjid && sheikh) return `*${masjid}* — بإشراف *الشيخ ${sheikh}*`
    if (masjid) return `*${masjid}*`
    if (sheikh) return `*حلقة القرآن الكريم* — بإشراف *الشيخ ${sheikh}*`
    return '*حلقة القرآن الكريم*'
  }
  return buildHalaqaSignature({ sheikhName, masjidName, style: 'emoji' })
}

export function formatArabicDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const datePart = d.toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      numberingSystem: 'latn',
    })
    const hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const hour12 = hours % 12 || 12
    const period = hours >= 12 ? 'مساءً' : 'صباحًا'
    return `${datePart}، ${hour12}:${minutes} ${period}`
  } catch {
    return '—'
  }
}

export function toWesternDigits(value) {
  return String(value || '').replace(/[٠-٩]/g, ch => String(ARABIC_INDIC.indexOf(ch)))
}

export function normalizeLinkCode(raw) {
  if (raw == null || raw === '') return null
  let s = toWesternDigits(String(raw).trim())
  s = s.replace(/[\s-]/g, '')
  if (/^\d{6}$/.test(s)) return s
  const hex = String(raw).trim().toUpperCase()
  if (/^[A-F0-9]{8}$/.test(hex)) return hex
  return null
}

export function formatLinkCodeForDisplay(code) {
  const normalized = normalizeLinkCode(code)
  if (!normalized) return null
  if (/^[A-F0-9]{8}$/.test(normalized)) return normalized
  if (normalized.length === 6) return `${normalized.slice(0, 3)} ${normalized.slice(3)}`
  return normalized
}
