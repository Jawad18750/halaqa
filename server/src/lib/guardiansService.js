import crypto from 'crypto'
import { pool } from './db.js'
import { normalizePhoneE164 } from './phone.js'

const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000

async function findGuardianByPhone(userId, phoneE164) {
  if (!phoneE164) return null
  const { rows } = await pool.query(
    'select id, name, phone_e164, notes, created_at, updated_at from guardians where user_id=$1 and phone_e164=$2',
    [userId, phoneE164]
  )
  return rows[0] || null
}

function attachDuplicateError(err, existing) {
  err.existingGuardianId = existing?.id
  err.existingGuardian = existing || null
  return err
}

export async function listGuardiansForUser(userId) {
  const { rows } = await pool.query(
    `select g.id, g.name, g.phone_e164, g.notes, g.created_at, g.updated_at,
            count(distinct gs.student_id)::int as student_count,
            bool_or(coalesce(gs.notify_weekly_attendance, false)) as notify_weekly_attendance,
            gt.telegram_chat_id is not null as telegram_linked,
            coalesce(gt.opt_out, false) as telegram_opt_out,
            gt.linked_at as telegram_linked_at,
            gt.telegram_username,
            gt.telegram_display_name,
            coalesce(
              json_agg(
                json_build_object('id', s.id, 'number', s.number, 'name', s.name)
                order by s.number asc
              ) filter (where s.id is not null),
              '[]'::json
            ) as students
     from guardians g
     left join guardian_students gs on gs.guardian_id = g.id
     left join students s on s.id = gs.student_id and s.user_id = g.user_id
     left join guardian_telegram gt on gt.guardian_id = g.id
     where g.user_id = $1
     group by g.id, gt.telegram_chat_id, gt.opt_out, gt.linked_at, gt.telegram_username, gt.telegram_display_name
     order by g.name asc`,
    [userId]
  )
  return rows
}

export async function createGuardian(userId, { name, phone, notes }) {
  const phone_e164 = normalizePhoneE164(phone)
  if (!phone_e164) throw Object.assign(new Error('رقم الهاتف غير صالح'), { status: 400 })
  if (!name?.trim()) throw Object.assign(new Error('الاسم مطلوب'), { status: 400 })

  const existing = await findGuardianByPhone(userId, phone_e164)
  if (existing) {
    throw attachDuplicateError(
      Object.assign(new Error('ولي أمر بهذا الرقم موجود مسبقاً'), { status: 409 }),
      existing
    )
  }

  try {
    const { rows } = await pool.query(
      `insert into guardians(user_id, name, phone_e164, notes)
       values($1, $2, $3, $4)
       returning id, name, phone_e164, notes, created_at, updated_at`,
      [userId, name.trim(), phone_e164, notes?.trim() || null]
    )
    return rows[0]
  } catch (e) {
    if (String(e.message).includes('unique')) {
      const dup = await findGuardianByPhone(userId, phone_e164)
      throw attachDuplicateError(
        Object.assign(new Error('ولي أمر بهذا الرقم موجود مسبقاً'), { status: 409 }),
        dup
      )
    }
    throw e
  }
}

async function resolveGuardianForLink(userId, input) {
  if (input.guardianId) {
    return assertGuardianOwned(userId, input.guardianId)
  }

  const phone_e164 = normalizePhoneE164(input.phone)
  if (!phone_e164) throw Object.assign(new Error('رقم الهاتف غير صالح'), { status: 400 })
  if (!input.name?.trim()) throw Object.assign(new Error('الاسم مطلوب'), { status: 400 })

  const existing = await findGuardianByPhone(userId, phone_e164)
  if (existing) {
    const nextName = input.name.trim()
    const nextNotes = input.notes?.trim() || null
    const shouldUpdate =
      (nextName && nextName !== existing.name)
      || (input.notes !== undefined && nextNotes !== (existing.notes || null))

    if (shouldUpdate) {
      const { rows } = await pool.query(
        `update guardians
         set name = coalesce(nullif($1, ''), name),
             notes = case when $3 then $2 else notes end,
             updated_at = now()
         where id = $4 and user_id = $5
         returning id, name, phone_e164, notes, created_at, updated_at`,
        [nextName, nextNotes, input.notes !== undefined, existing.id, userId]
      )
      return rows[0] || existing
    }
    return existing
  }

  return createGuardian(userId, {
    name: input.name,
    phone: phone_e164,
    notes: input.notes,
  })
}

export async function updateGuardian(userId, guardianId, { name, phone, notes }) {
  const current = await assertGuardianOwned(userId, guardianId)
  const fields = []
  const vals = []
  let idx = 1
  let nextPhone = current.phone_e164

  if (name !== undefined) {
    if (!String(name).trim()) throw Object.assign(new Error('الاسم مطلوب'), { status: 400 })
    fields.push(`name=$${idx++}`)
    vals.push(String(name).trim())
  }
  if (phone !== undefined) {
    const phone_e164 = normalizePhoneE164(phone)
    if (!phone_e164) throw Object.assign(new Error('رقم الهاتف غير صالح'), { status: 400 })
    nextPhone = phone_e164
    fields.push(`phone_e164=$${idx++}`)
    vals.push(phone_e164)
  }
  if (notes !== undefined) {
    fields.push(`notes=$${idx++}`)
    vals.push(notes?.trim() || null)
  }
  if (!fields.length) throw Object.assign(new Error('لا توجد حقول للتحديث'), { status: 400 })

  if (phone !== undefined) {
    const duplicate = await findGuardianByPhone(userId, nextPhone)
    if (duplicate && duplicate.id !== guardianId) {
      throw attachDuplicateError(
        Object.assign(new Error('رقم الهاتف مستخدم لولي آخر'), { status: 409 }),
        duplicate
      )
    }
  }

  vals.push(userId, guardianId)
  try {
    const { rows } = await pool.query(
      `update guardians set ${fields.join(', ')}, updated_at=now()
       where user_id=$${idx++} and id=$${idx}
       returning id, name, phone_e164, notes, created_at, updated_at`,
      vals
    )
    if (!rows.length) throw Object.assign(new Error('غير موجود'), { status: 404 })
    return rows[0]
  } catch (e) {
    if (String(e.message).includes('unique')) {
      const duplicate = await findGuardianByPhone(userId, nextPhone)
      throw attachDuplicateError(
        Object.assign(new Error('رقم الهاتف مستخدم لولي آخر'), { status: 409 }),
        duplicate
      )
    }
    throw e
  }
}

export async function deleteGuardian(userId, guardianId) {
  const { rowCount } = await pool.query(
    'delete from guardians where user_id=$1 and id=$2',
    [userId, guardianId]
  )
  if (!rowCount) throw Object.assign(new Error('غير موجود'), { status: 404 })
}

export async function assertStudentOwned(userId, studentId) {
  const { rows } = await pool.query(
    'select id, name from students where id=$1 and user_id=$2',
    [studentId, userId]
  )
  if (!rows.length) throw Object.assign(new Error('الطالب غير موجود'), { status: 404 })
  return rows[0]
}

export async function assertGuardianOwned(userId, guardianId) {
  const { rows } = await pool.query(
    'select id, name, phone_e164, notes, created_at, updated_at from guardians where id=$1 and user_id=$2',
    [guardianId, userId]
  )
  if (!rows.length) throw Object.assign(new Error('ولي الأمر غير موجود'), { status: 404 })
  return rows[0]
}

export async function listGuardiansForStudent(userId, studentId) {
  await assertStudentOwned(userId, studentId)
  const { rows } = await pool.query(
    `select gs.id as link_id, gs.relationship, gs.is_primary, gs.notify_on_result, gs.notify_weekly_attendance,
            g.id, g.name, g.phone_e164, g.notes,
            gt.telegram_chat_id is not null as telegram_linked,
            coalesce(gt.opt_out, false) as telegram_opt_out,
            gt.linked_at as telegram_linked_at,
            gt.telegram_username,
            gt.telegram_display_name
     from guardian_students gs
     join guardians g on g.id = gs.guardian_id and g.user_id = $1
     left join guardian_telegram gt on gt.guardian_id = g.id
     where gs.student_id = $2
     order by gs.is_primary desc, g.name asc`,
    [userId, studentId]
  )
  return rows
}

async function clearPrimaryForStudent(client, studentId, exceptLinkId = null) {
  if (exceptLinkId) {
    await client.query(
      'update guardian_students set is_primary=false where student_id=$1 and id != $2',
      [studentId, exceptLinkId]
    )
  } else {
    await client.query(
      'update guardian_students set is_primary=false where student_id=$1',
      [studentId]
    )
  }
}

export async function linkGuardianToStudent(userId, studentId, input) {
  await assertStudentOwned(userId, studentId)

  let reused = false
  if (!input.guardianId) {
    const phone_e164 = normalizePhoneE164(input.phone)
    if (phone_e164) {
      const existing = await findGuardianByPhone(userId, phone_e164)
      reused = Boolean(existing)
    }
  }

  const guardian = await resolveGuardianForLink(userId, input)
  const guardianId = guardian.id

  const client = await pool.connect()
  try {
    await client.query('begin')

    const existingPrimary = await client.query(
      'select id from guardian_students where student_id=$1 and is_primary=true limit 1',
      [studentId]
    )
    const isFirst = !existingPrimary.rows.length
    const isPrimary = input.is_primary === true || isFirst
    const notifyOnResult = input.notify_on_result === true || isPrimary
    const notifyWeeklyAttendance = true

    if (isPrimary) {
      await clearPrimaryForStudent(client, studentId)
    }

    const { rows } = await client.query(
      `insert into guardian_students(guardian_id, student_id, relationship, is_primary, notify_on_result, notify_weekly_attendance)
       values($1, $2, $3, $4, $5, $6)
       on conflict (guardian_id, student_id) do update set
         relationship=coalesce(excluded.relationship, guardian_students.relationship),
         is_primary=excluded.is_primary,
         notify_on_result=excluded.notify_on_result,
         notify_weekly_attendance=excluded.notify_weekly_attendance
       returning *`,
      [
        guardianId,
        studentId,
        input.relationship?.trim() || null,
        isPrimary,
        notifyOnResult,
        notifyWeeklyAttendance,
      ]
    )

    await client.query('commit')
    return { link: rows[0], guardian, reused }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function updateGuardianLink(userId, linkId, { relationship, is_primary, notify_on_result, notify_weekly_attendance }) {
  const linkQ = await pool.query(
    `select gs.*, g.user_id
     from guardian_students gs
     join guardians g on g.id = gs.guardian_id
     where gs.id = $1 and g.user_id = $2`,
    [linkId, userId]
  )
  if (!linkQ.rows.length) throw Object.assign(new Error('الرابط غير موجود'), { status: 404 })
  const link = linkQ.rows[0]

  const client = await pool.connect()
  try {
    await client.query('begin')

    if (is_primary === true) {
      await clearPrimaryForStudent(client, link.student_id, linkId)
    }

    const fields = []
    const vals = []
    let idx = 1
    if (relationship !== undefined) {
      fields.push(`relationship=$${idx++}`)
      vals.push(relationship?.trim() || null)
    }
    if (is_primary !== undefined) {
      fields.push(`is_primary=$${idx++}`)
      vals.push(!!is_primary)
    }
    if (notify_on_result !== undefined) {
      fields.push(`notify_on_result=$${idx++}`)
      vals.push(!!notify_on_result)
    }
    // Weekly attendance summaries are always on; ignore client attempts to disable.
    void notify_weekly_attendance
    if (!fields.length) throw Object.assign(new Error('لا توجد حقول للتحديث'), { status: 400 })

    vals.push(linkId)
    const { rows } = await client.query(
      `update guardian_students set ${fields.join(', ')} where id=$${idx} returning *`,
      vals
    )

    await client.query('commit')
    return rows[0]
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function deleteGuardianLink(userId, linkId) {
  const linkQ = await pool.query(
    `select gs.*, g.user_id, g.id as guardian_id
     from guardian_students gs
     join guardians g on g.id = gs.guardian_id
     where gs.id = $1 and g.user_id = $2`,
    [linkId, userId]
  )
  if (!linkQ.rows.length) throw Object.assign(new Error('الرابط غير موجود'), { status: 404 })
  const link = linkQ.rows[0]

  if (link.is_primary) {
    const others = await pool.query(
      'select id from guardian_students where student_id=$1 and id != $2 limit 1',
      [link.student_id, linkId]
    )
    if (others.rows.length) {
      throw Object.assign(new Error('عيّن ولياً أساسياً آخر قبل الحذف'), { status: 400 })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('delete from guardian_students where id=$1', [linkId])

    const remaining = await client.query(
      'select id from guardian_students where guardian_id=$1 limit 1',
      [link.guardian_id]
    )
    let guardianDeleted = false
    if (!remaining.rows.length) {
      await client.query('delete from guardians where id=$1 and user_id=$2', [link.guardian_id, userId])
      guardianDeleted = true
    }

    await client.query('commit')
    return { guardianDeleted }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

function generateLinkCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export async function createLinkCode(userId, guardianId) {
  await assertGuardianOwned(userId, guardianId)

  await pool.query(
    `update telegram_link_codes set used_at=now()
     where guardian_id=$1 and used_at is null`,
    [guardianId]
  )

  const code = generateLinkCode()
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS)

  await pool.query(
    `insert into telegram_link_codes(user_id, guardian_id, code, expires_at)
     values($1, $2, $3, $4)`,
    [userId, guardianId, code, expiresAt.toISOString()]
  )

  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'Halaqa_Test_bot').replace(/^@/, '')
  const deepLink = `https://t.me/${botUsername}?start=${code}`

  return { code, expiresAt: expiresAt.toISOString(), deepLink }
}

export async function revokeTelegramLink(userId, guardianId) {
  await assertGuardianOwned(userId, guardianId)

  const { rowCount } = await pool.query(
    'delete from guardian_telegram where guardian_id=$1',
    [guardianId]
  )
  if (!rowCount) {
    throw Object.assign(new Error('لا يوجد ربط Telegram'), { status: 404 })
  }

  await pool.query(
    `update telegram_link_codes set used_at=now()
     where guardian_id=$1 and used_at is null`,
    [guardianId]
  )
}

async function mergeGuardianRecords(userId, fromId, toId) {
  if (fromId === toId) return

  const { rows: links } = await pool.query(
    'select id, student_id from guardian_students where guardian_id=$1',
    [fromId]
  )
  for (const link of links) {
    const { rows: existing } = await pool.query(
      'select id from guardian_students where guardian_id=$1 and student_id=$2',
      [toId, link.student_id]
    )
    if (existing.length) {
      await pool.query('delete from guardian_students where id=$1', [link.id])
    } else {
      await pool.query('update guardian_students set guardian_id=$1 where id=$2', [toId, link.id])
    }
  }

  const { rows: targetTelegram } = await pool.query(
    'select guardian_id from guardian_telegram where guardian_id=$1',
    [toId]
  )
  if (!targetTelegram.length) {
    await pool.query('update guardian_telegram set guardian_id=$1 where guardian_id=$2', [toId, fromId])
  } else {
    await pool.query('delete from guardian_telegram where guardian_id=$1', [fromId])
  }

  await pool.query('delete from telegram_link_codes where guardian_id=$1', [fromId])
  await pool.query('delete from guardians where id=$1 and user_id=$2', [fromId, userId])
}

export async function normalizeGuardianPhonesInDb() {
  const { rows } = await pool.query('select id, user_id, phone_e164 from guardians order by created_at asc')
  let updated = 0
  let merged = 0

  for (const row of rows) {
    const canonical = normalizePhoneE164(row.phone_e164)
    if (!canonical) continue

    const stillThere = await pool.query('select id, phone_e164 from guardians where id=$1', [row.id])
    if (!stillThere.rows.length) continue

    if (canonical === stillThere.rows[0].phone_e164) continue

    const dup = await findGuardianByPhone(row.user_id, canonical)
    if (dup && dup.id !== row.id) {
      await mergeGuardianRecords(row.user_id, row.id, dup.id)
      merged += 1
      continue
    }

    await pool.query('update guardians set phone_e164=$1, updated_at=now() where id=$2', [canonical, row.id])
    updated += 1
  }

  return { updated, merged, total: rows.length }
}
