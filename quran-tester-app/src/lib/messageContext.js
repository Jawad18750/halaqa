export function buildHalaqaSignature({ sheikhName, masjidName, style = 'emoji' } = {}) {
  const sheikh = String(sheikhName || '').trim()
  const masjid = String(masjidName || '').trim()
  if (!sheikh && !masjid) return null

  if (style === 'plain') {
    if (masjid && sheikh) return `*${masjid}* — *الشيخ ${sheikh}*`
    if (masjid) return `*${masjid}*`
    return `*الشيخ ${sheikh}*`
  }

  if (style === 'footer') {
    const lines = []
    if (masjid) lines.push(`🕌 ${masjid}`)
    if (sheikh) lines.push(`👤 الشيخ: ${sheikh}`)
    return lines.join('\n')
  }

  if (masjid && sheikh) return `🕌 ${masjid} — الشيخ ${sheikh}`
  if (masjid) return `🕌 ${masjid}`
  return `👤 الشيخ ${sheikh}`
}

export function buildHalaqaIntro({ sheikhName, masjidName, style = 'emoji' } = {}) {
  const sig = buildHalaqaSignature({ sheikhName, masjidName, style })
  if (sig) return sig
  return style === 'plain' ? '*حلقة اختبار القرآن*' : '📚 حلقة اختبار القرآن'
}
