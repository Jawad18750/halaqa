import { pool } from './db.js'

export async function getUserSettings(userId) {
  const { rows } = await pool.query(
    'select id, username, email, sheikh_name, masjid_name from users where id = $1',
    [userId]
  )
  if (!rows.length) return null
  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    sheikh_name: row.sheikh_name || '',
    masjid_name: row.masjid_name || '',
  }
}

export async function updateUserSettings(userId, { sheikh_name, masjid_name }) {
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
  if (!fields.length) throw Object.assign(new Error('لا توجد حقول للتحديث'), { status: 400 })

  vals.push(userId)
  const { rows } = await pool.query(
    `update users set ${fields.join(', ')} where id = $${idx}
     returning id, username, email, sheikh_name, masjid_name`,
    vals
  )
  if (!rows.length) throw Object.assign(new Error('غير موجود'), { status: 404 })
  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    sheikh_name: row.sheikh_name || '',
    masjid_name: row.masjid_name || '',
  }
}
