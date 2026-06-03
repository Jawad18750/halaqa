import Holidays from 'date-holidays'
import { pool } from './db.js'

export const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const DEFAULT_STUDY_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed']
export const HALAQA_TIME_ZONE = 'Africa/Tripoli'

function datePartsInTimeZone(date = new Date(), timeZone = HALAQA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function todayInHalaqaTimeZone(date = new Date()) {
  return datePartsInTimeZone(date, HALAQA_TIME_ZONE)
}

export function weekdayInHalaqaTimeZone(input = new Date()) {
  const date = input instanceof Date
    ? input
    : new Date(`${normalizeDateString(input)}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: HALAQA_TIME_ZONE,
    weekday: 'short',
  }).format(date).toLowerCase()
  return {
    sun: 'sun',
    mon: 'mon',
    tue: 'tue',
    wed: 'wed',
    thu: 'thu',
    fri: 'fri',
    sat: 'sat',
  }[weekday] || DAY_CODES[date.getUTCDay()]
}

function normalizeDateString(input = new Date()) {
  if (input instanceof Date) {
    return todayInHalaqaTimeZone(input)
  }
  const value = String(input || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayInHalaqaTimeZone()
}

function normalizeStudyDays(days) {
  const source = Array.isArray(days) ? days : DEFAULT_STUDY_DAYS
  const clean = source.filter(day => DEFAULT_STUDY_DAYS.concat(['thu', 'fri']).includes(day))
  return clean.length ? [...new Set(clean)] : DEFAULT_STUDY_DAYS
}

export function normalizeHolidayOverrides(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const open = source.open && typeof source.open === 'object' && !Array.isArray(source.open) ? source.open : {}
  const closed = source.closed && typeof source.closed === 'object' && !Array.isArray(source.closed) ? source.closed : {}
  return { open, closed }
}

export function calendarSettingsFromRow(row = {}) {
  return {
    study_days: normalizeStudyDays(row.study_days),
    holiday_country: row.holiday_country || 'LY',
    holiday_overrides: normalizeHolidayOverrides(row.holiday_overrides),
  }
}

export async function getCalendarSettings(userId) {
  const { rows } = await pool.query(
    'select study_days, holiday_country, holiday_overrides from users where id=$1',
    [userId]
  )
  return calendarSettingsFromRow(rows[0] || {})
}

export function getCalendarStatus(dateInput, settings = {}) {
  const date = normalizeDateString(dateInput)
  const day = weekdayInHalaqaTimeZone(dateInput instanceof Date ? dateInput : date)
  const studyDays = normalizeStudyDays(settings.study_days)
  const country = settings.holiday_country || 'LY'
  const overrides = normalizeHolidayOverrides(settings.holiday_overrides)
  const overrideOpen = overrides.open?.[date] || null
  const overrideClosed = overrides.closed?.[date] || null
  const reasons = []
  let builtInHoliday = null

  if (country && country !== 'none') {
    try {
      const hd = new Holidays(country)
      const match = hd.isHoliday(new Date(`${date}T12:00:00Z`))
      builtInHoliday = Array.isArray(match) ? match[0] : match
      if (builtInHoliday?.name) reasons.push(builtInHoliday.name)
    } catch {}
  }

  if (!studyDays.includes(day)) reasons.push('خارج أيام الدراسة')
  if (overrideClosed) reasons.push(typeof overrideClosed === 'string' ? overrideClosed : overrideClosed.reason || 'عطلة مخصصة')

  let closed = reasons.length > 0
  if (overrideOpen) closed = false

  return {
    date,
    day,
    studyDays,
    closed,
    isStudyDay: studyDays.includes(day),
    builtInHoliday: builtInHoliday ? { name: builtInHoliday.name, type: builtInHoliday.type || null } : null,
    override: overrideOpen
      ? { type: 'open', reason: typeof overrideOpen === 'string' ? overrideOpen : overrideOpen.reason || '' }
      : overrideClosed
        ? { type: 'closed', reason: typeof overrideClosed === 'string' ? overrideClosed : overrideClosed.reason || '' }
        : null,
    reasons: overrideOpen ? [] : reasons,
  }
}
