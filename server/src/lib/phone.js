const DEFAULT_REGION = (process.env.DEFAULT_PHONE_REGION || 'LY').toUpperCase()

const REGION_CALLING = {
  LY: '218',
  EG: '20',
}

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const EXT_ARABIC_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function toWesternDigits(input) {
  return String(input || '').replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC_DIGITS.indexOf(ch)))
    .replace(/[۰-۹]/g, (ch) => String(EXT_ARABIC_INDIC_DIGITS.indexOf(ch)))
}

function digitsOnly(input) {
  return toWesternDigits(input).replace(/\D/g, '')
}

function stripInternationalPrefix(digits) {
  if (digits.startsWith('00')) return digits.slice(2)
  return digits
}

function stripTrunkZeroAfterCountry(e164) {
  for (const calling of new Set(Object.values(REGION_CALLING))) {
    const prefix = `+${calling}`
    if (!e164.startsWith(prefix)) continue
    const national = e164.slice(prefix.length)
    if (!national.startsWith('0')) continue
    const trimmed = national.replace(/^0+/, '')
    if (!trimmed) continue
    const candidate = `${prefix}${trimmed}`
    if (candidate.length >= 11 && candidate.length <= 16) return candidate
  }
  return e164
}

function isValidE164(e164) {
  const digits = digitsOnly(e164)
  return digits.length >= 10 && digits.length <= 15
}

/**
 * Normalize phone to E.164. Default region LY (+218) when no country code.
 * Returns null if invalid.
 */
export function normalizePhoneE164(input, region = DEFAULT_REGION) {
  if (input == null) return null
  let raw = String(input).trim()
  if (!raw) return null

  if (raw.startsWith('+')) {
    let d = stripInternationalPrefix(digitsOnly(raw))
    if (d.length < 8 || d.length > 15) return null
    return stripTrunkZeroAfterCountry(`+${d}`)
  }

  let d = stripInternationalPrefix(digitsOnly(raw))
  if (!d) return null

  const calling = REGION_CALLING[region] || REGION_CALLING[DEFAULT_REGION] || REGION_CALLING.LY

  if (d.startsWith('0')) {
    const national = d.replace(/^0+/, '')
    const full = `${calling}${national}`
    if (full.length < 10 || full.length > 15) return null
    return stripTrunkZeroAfterCountry(`+${full}`)
  }

  if (d.startsWith(calling) && d.length >= 10) {
    return stripTrunkZeroAfterCountry(`+${d}`)
  }

  const full = `${calling}${d}`
  if (full.length < 10 || full.length > 15) return null
  const result = stripTrunkZeroAfterCountry(`+${full}`)
  return isValidE164(result) ? result : null
}

export function formatPhoneDisplay(e164) {
  if (!e164) return ''
  return e164
}

export function phonesEquivalent(a, b, region = DEFAULT_REGION) {
  const left = normalizePhoneE164(a, region)
  const right = normalizePhoneE164(b, region)
  if (!left || !right) return false
  return left === right
}
