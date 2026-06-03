import { pool } from './db.js'
import { DEFAULT_STUDY_DAYS, calendarSettingsFromRow, normalizeHolidayOverrides } from './halaqaCalendar.js'

export async function getUserSettings(userId) {
  const { rows } = await pool.query(
    'select id, username, email, sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides from users where id = $1',
    [userId]
  )
  if (!rows.length) return null
  const row = rows[0]
  const calendar = calendarSettingsFromRow(row)
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    sheikh_name: row.sheikh_name || '',
    masjid_name: row.masjid_name || '',
    ...calendar,
  }
}

function normalizeStudyDaysInput(days) {
  if (!Array.isArray(days)) return null
  const valid = new Set(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'])
  const clean = [...new Set(days.map(String).filter(day => valid.has(day)))]
  return clean.length ? clean : DEFAULT_STUDY_DAYS
}

export async function updateUserSettings(userId, { sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides }) {
  const fields = []
  const vals = []
  let idx = 1

  if (sheikh_name !== undefined) {
    fields.push(`sheikh_name=$${idx++}`)
    vals.push(String(sheikh_name || '').trim() || null)
  }
  if (masjid_name !== undefined) {
    fields.push(`masjid_name=$${idx++}`)
    vals.push(String(masjid_name || '').trim() || null)
  }
  if (study_days !== undefined) {
    fields.push(`study_days=$${idx++}`)
    vals.push(normalizeStudyDaysInput(study_days))
  }
  if (holiday_country !== undefined) {
    const country = String(holiday_country || '').trim()
    fields.push(`holiday_country=$${idx++}`)
    vals.push(country || null)
  }
  if (holiday_overrides !== undefined) {
    fields.push(`holiday_overrides=$${idx++}::jsonb`)
    vals.push(JSON.stringify(normalizeHolidayOverrides(holiday_overrides)))
  }
  if (!fields.length) throw Object.assign(new Error('لا توجد حقول للتحديث'), { status: 400 })

  vals.push(userId)
  const { rows } = await pool.query(
    `update users set ${fields.join(', ')} where id = $${idx}
     returning id, username, email, sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides`,
    vals
  )
  if (!rows.length) throw Object.assign(new Error('غير موجود'), { status: 404 })
  const row = rows[0]
  const calendar = calendarSettingsFromRow(row)
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    sheikh_name: row.sheikh_name || '',
    masjid_name: row.masjid_name || '',
    ...calendar,
  }
}
