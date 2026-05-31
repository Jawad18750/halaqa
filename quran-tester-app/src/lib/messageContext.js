const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

/** Join logical sections with one blank line; lines within a section stay single-spaced. */
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

  // emoji intro (section 1.1)
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

export function hasHalaqaSettings({ sheikhName, masjidName } = {}) {
  return Boolean(String(sheikhName || '').trim() || String(masjidName || '').trim())
}

export function appendSignatureFooter(message, { sheikhName, masjidName } = {}) {
  const footer = buildHalaqaSignature({ sheikhName, masjidName, style: 'footer' })
  if (!footer) return String(message || '').trim()
  const trimmed = String(message || '').trim()
  if (!trimmed) return footer
  if (trimmed.endsWith(footer) || trimmed.includes(`\n${footer}`)) return trimmed
  return `${trimmed}\n\n${footer}`
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

/** Normalize invite code input to 6 Western digits, or null. */
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
