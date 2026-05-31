const DEFAULT_REGION = (process.env.DEFAULT_PHONE_REGION || 'LY').toUpperCase()

const REGION_CALLING = {
  LY: '218',
  EG: '20',
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '')
}

/**
 * Normalize phone to E.164. Default region LY (+218) when no country code.
 * Returns null if invalid.
 */
export function normalizePhoneE164(input, region = DEFAULT_REGION) {
  if (!input || typeof input !== 'string') return null
  let raw = input.trim()
  if (!raw) return null

  if (raw.startsWith('+')) {
    const d = digitsOnly(raw)
    if (d.length < 8 || d.length > 15) return null
    return `+${d}`
  }

  const d = digitsOnly(raw)
  if (!d) return null

  const calling = REGION_CALLING[region] || REGION_CALLING[DEFAULT_REGION] || REGION_CALLING.LY

  // Local leading zero (e.g. 091xxxxxxx in Libya)
  if (d.startsWith('0')) {
    const national = d.replace(/^0+/, '')
    const full = `${calling}${national}`
    if (full.length < 10 || full.length > 15) return null
    return `+${full}`
  }

  // Already includes country code without +
  if (d.startsWith(calling) && d.length >= 10) {
    return `+${d}`
  }

  // Assume national number for default region
  const full = `${calling}${d}`
  if (full.length < 10 || full.length > 15) return null
  return `+${full}`
}

export function formatPhoneDisplay(e164) {
  if (!e164) return ''
  return e164
}
