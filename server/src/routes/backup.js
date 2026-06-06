import express, { Router } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { DEFAULT_STUDY_DAYS, normalizeHolidayOverrides } from '../lib/halaqaCalendar.js'

const router = Router()
// Allow larger payloads for embedded photos
router.use(express.json({ limit: '25mb' }))
router.use(requireAuth)

// Resolve uploads root similar to students route
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'src', 'uploads')

function readAvatarBase64(studentId) {
  const sizes = ['128', '256', '512']
  const result = {}
  const studentDir = path.join(uploadsRoot, 'students', studentId)
  for (const size of sizes) {
    const filePath = path.join(studentDir, `avatar-${size}.jpg`)
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath)
        result[size] = `data:image/jpeg;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.error('[backup] failed to read avatar', filePath, e?.message)
    }
  }
  return Object.keys(result).length ? result : null
}

router.get('/export', async (req, res) => {
  try {
    const includePhotos = (req.query.photos || '').toString() === '1'

    const userQ = await pool.query(
      'select id, username, email, sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides, created_at from users where id=$1',
      [req.user.id]
    )
    const user = userQ.rows[0] || null

    const studentsQ = await pool.query(
      `select id, number, name, current_naqza, memorization_thumun_id, memorization_surah, qalam_count, photo_url, date_of_birth, qr_token, created_at, updated_at
       from students where user_id=$1 order by number asc`,
      [req.user.id]
    )
    const students = studentsQ.rows

    const sessionsQ = await pool.query(
      `select s.*
       from sessions s
       join students st on st.id = s.student_id
       where st.user_id = $1
       order by s.created_at desc`,
      [req.user.id]
    )
    const sessions = sessionsQ.rows

    const guardiansQ = await pool.query(
      `select id, name, phone_e164, notes, created_at, updated_at
       from guardians where user_id=$1 order by name asc`,
      [req.user.id]
    )
    const guardians = guardiansQ.rows

    const guardianStudentsQ = await pool.query(
      `select gs.id, gs.guardian_id, gs.student_id, gs.relationship, gs.is_primary, gs.notify_on_result, gs.notify_weekly_attendance
       from guardian_students gs
       join guardians g on g.id = gs.guardian_id
       where g.user_id = $1`,
      [req.user.id]
    )
    const guardianStudents = guardianStudentsQ.rows

    const guardianTelegramQ = await pool.query(
      `select gt.guardian_id, gt.telegram_chat_id, gt.telegram_username, gt.linked_at, gt.opt_out
       from guardian_telegram gt
       join guardians g on g.id = gt.guardian_id
       where g.user_id = $1`,
      [req.user.id]
    )
    const guardianTelegram = guardianTelegramQ.rows

    const attendanceQ = await pool.query(
      `select ar.*
       from attendance_records ar
       join students st on st.id = ar.student_id
       where st.user_id = $1
       order by ar.attendance_date desc, ar.recorded_at desc`,
      [req.user.id]
    )
    const attendanceRecords = attendanceQ.rows

    const photos = {}
    if (includePhotos) {
      for (const s of students) {
        const encoded = readAvatarBase64(s.id)
        if (encoded) photos[s.id] = encoded
      }
    }

    const payload = {
      version: 'halaqa-backup-v3',
      exportedAt: new Date().toISOString(),
      user,
      counts: {
        students: students.length,
        sessions: sessions.length,
        attendanceRecords: attendanceRecords.length,
        photos: Object.keys(photos).length,
        guardians: guardians.length,
      },
      students,
      sessions,
      attendanceRecords,
      guardians,
      guardianStudents,
      guardianTelegram,
      photos: includePhotos ? photos : undefined
    }

    const fname = `halaqa-backup-${(user?.username || 'user').replace(/[^a-z0-9_-]/ig, '') || 'user'}-${new Date().toISOString().slice(0,10)}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=\"${fname}\"`)
    const buf = Buffer.from(JSON.stringify(payload))
    return res.status(200).send(buf)
  } catch (e) {
    console.error('[backup/export] error', e?.message)
    return res.status(500).json({ error: 'failed to export backup' })
  }
})

router.post('/import', async (req, res) => {
  const payload = req.body || {}
  const version = payload?.version
  if (!payload || !['halaqa-backup-v1', 'halaqa-backup-v2', 'halaqa-backup-v3'].includes(version)) {
    return res.status(400).json({ error: 'invalid or unsupported backup version' })
  }
  const students = Array.isArray(payload.students) ? payload.students : []
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
  const photos = payload.photos && typeof payload.photos === 'object' ? payload.photos : {}
  const guardians = version === 'halaqa-backup-v2' && Array.isArray(payload.guardians) ? payload.guardians : []
  const guardianStudents = version === 'halaqa-backup-v2' && Array.isArray(payload.guardianStudents) ? payload.guardianStudents : []
  const guardianTelegram = version === 'halaqa-backup-v2' && Array.isArray(payload.guardianTelegram) ? payload.guardianTelegram : []
  const v3 = version === 'halaqa-backup-v3'
  const v2Plus = version === 'halaqa-backup-v2' || v3
  const v3User = v3 && payload.user && typeof payload.user === 'object' ? payload.user : {}
  const attendanceRecords = v3 && Array.isArray(payload.attendanceRecords) ? payload.attendanceRecords : []
  const importedGuardians = v2Plus && Array.isArray(payload.guardians) ? payload.guardians : []
  const importedGuardianStudents = v2Plus && Array.isArray(payload.guardianStudents) ? payload.guardianStudents : []
  const importedGuardianTelegram = v2Plus && Array.isArray(payload.guardianTelegram) ? payload.guardianTelegram : []

  const stats = {
    students: { inserted: 0, updated: 0, skipped: 0, conflicts: 0 },
    sessions: { inserted: 0, updated: 0, skipped: 0, conflicts: 0 },
    photos: { saved: 0 },
    guardians: { inserted: 0, updated: 0, skipped: 0 },
    guardianStudents: { inserted: 0, updated: 0, skipped: 0 },
    guardianTelegram: { inserted: 0, updated: 0, skipped: 0 },
    attendanceRecords: { inserted: 0, updated: 0, skipped: 0 },
    settings: { updated: false },
  }

  const client = await pool.connect()
  try {
    await client.query('begin')

    if (v3) {
      await client.query(
        `update users
         set sheikh_name=coalesce($1, sheikh_name),
             masjid_name=coalesce($2, masjid_name),
             study_days=coalesce($3, study_days),
             holiday_country=coalesce($4, holiday_country),
             holiday_overrides=coalesce($5::jsonb, holiday_overrides)
         where id=$6`,
        [
          v3User.sheikh_name || null,
          v3User.masjid_name || null,
          Array.isArray(v3User.study_days) && v3User.study_days.length ? v3User.study_days : DEFAULT_STUDY_DAYS,
          v3User.holiday_country || 'LY',
          JSON.stringify(normalizeHolidayOverrides(v3User.holiday_overrides)),
          req.user.id,
        ]
      )
      stats.settings.updated = true
    }

    // Upsert students scoped to current user
    for (const s of students) {
      if (!s?.id || !s?.name || !s?.number) { stats.students.skipped++; continue }
      const created = s.created_at || new Date().toISOString()
      const updated = s.updated_at || created
      const photoUrl = s.photo_url || null
      const dob = s.date_of_birth || null
      const qrToken = s.qr_token || crypto.randomUUID().replace(/-/g, '')
      const result = await client.query(
        `insert into students(id, user_id, number, name, current_naqza, memorization_thumun_id, photo_url, date_of_birth, qr_token, created_at, updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set
           number=excluded.number,
           name=excluded.name,
           current_naqza=excluded.current_naqza,
           memorization_thumun_id=excluded.memorization_thumun_id,
           photo_url=excluded.photo_url,
           date_of_birth=excluded.date_of_birth,
           qr_token=coalesce(students.qr_token, excluded.qr_token),
           updated_at=excluded.updated_at
         where students.user_id = excluded.user_id
         returning xmax = 0 as inserted`,
        [s.id, req.user.id, s.number, s.name, s.current_naqza ?? 1, s.memorization_thumun_id ?? null, photoUrl, dob, qrToken, created, updated]
      )
      if (!result.rowCount) {
        stats.students.skipped++
        stats.students.conflicts++
        continue
      }
      if (result.rows[0]?.inserted) stats.students.inserted++
      else stats.students.updated++
    }

    // Upsert sessions scoped to student's ownership
    for (const sess of sessions) {
      if (!sess?.id || !sess?.student_id || !sess?.thumun_id) { stats.sessions.skipped++; continue }
      // Ensure student belongs to user
      const owned = await client.query('select 1 from students where id=$1 and user_id=$2', [sess.student_id, req.user.id])
      if (!owned.rows.length) { stats.sessions.skipped++; continue }
      const created = sess.created_at || new Date().toISOString()
      const updated = sess.updated_at || sess.attempt_at || created
      const result = await client.query(
        `insert into sessions(
           id, student_id, week_start_date, attempt_day, mode, selected_naqza, selected_juz,
           selected_five_hizb, selected_quran_quarter, selected_quran_half,
           thumun_id, surah_number, hizb, juz, naqza, fatha_prompts, taradud_count, passed, score, test_try_number, teacher_notes,
           attempt_at, created_at, updated_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,
           $8,$9,$10,
           $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
           $22,$23,$24
         )
         on conflict (id) do update set
           week_start_date=excluded.week_start_date,
           attempt_day=excluded.attempt_day,
           mode=excluded.mode,
           selected_naqza=excluded.selected_naqza,
           selected_juz=excluded.selected_juz,
           selected_five_hizb=excluded.selected_five_hizb,
           selected_quran_quarter=excluded.selected_quran_quarter,
           selected_quran_half=excluded.selected_quran_half,
           thumun_id=excluded.thumun_id,
           surah_number=excluded.surah_number,
           hizb=excluded.hizb,
           juz=excluded.juz,
           naqza=excluded.naqza,
           fatha_prompts=excluded.fatha_prompts,
           taradud_count=excluded.taradud_count,
           passed=excluded.passed,
           score=excluded.score,
           test_try_number=excluded.test_try_number,
           teacher_notes=excluded.teacher_notes,
           attempt_at=excluded.attempt_at,
           updated_at=excluded.updated_at
         where exists (
           select 1 from students st
           where st.id = sessions.student_id and st.user_id = $25
         )
         and exists (
           select 1 from students st
           where st.id = excluded.student_id and st.user_id = $25
         )
         returning xmax = 0 as inserted`,
        [
          sess.id,
          sess.student_id,
          sess.week_start_date,
          sess.attempt_day,
          sess.mode,
          sess.selected_naqza ?? null,
          sess.selected_juz ?? null,
          sess.selected_five_hizb ?? null,
          sess.selected_quran_quarter ?? null,
          sess.selected_quran_half ?? null,
          sess.thumun_id,
          sess.surah_number ?? null,
          sess.hizb ?? null,
          sess.juz ?? null,
          sess.naqza ?? null,
          sess.fatha_prompts ?? 0,
          sess.taradud_count ?? 0,
          sess.passed ?? false,
          sess.score ?? 0,
          sess.test_try_number ?? 1,
          sess.teacher_notes ?? null,
          sess.attempt_at || created,
          created,
          updated,
          req.user.id
        ]
      )
      if (!result.rowCount) {
        stats.sessions.skipped++
        stats.sessions.conflicts++
        continue
      }
      if (result.rows[0]?.inserted) stats.sessions.inserted++
      else stats.sessions.updated++
    }

    for (const ar of attendanceRecords) {
      if (!ar?.id || !ar?.student_id || !ar?.attendance_date) { stats.attendanceRecords.skipped++; continue }
      const owned = await client.query('select 1 from students where id=$1 and user_id=$2', [ar.student_id, req.user.id])
      if (!owned.rows.length) { stats.attendanceRecords.skipped++; continue }
      const result = await client.query(
        `insert into attendance_records(id, student_id, attendance_date, recorded_at, source, created_at)
         values($1,$2,$3::date,$4,$5,$6)
         on conflict (student_id, attendance_date) do update set
           recorded_at=excluded.recorded_at,
           source=excluded.source
         returning xmax = 0 as inserted`,
        [
          ar.id,
          ar.student_id,
          ar.attendance_date,
          ar.recorded_at || new Date().toISOString(),
          ar.source === 'manual' ? 'manual' : 'qr',
          ar.created_at || new Date().toISOString(),
        ]
      )
      if (!result.rowCount) { stats.attendanceRecords.skipped++; continue }
      if (result.rows[0]?.inserted) stats.attendanceRecords.inserted++
      else stats.attendanceRecords.updated++
    }

    // Upsert guardians (v2+)
    for (const g of importedGuardians) {
      if (!g?.id || !g?.name || !g?.phone_e164) { stats.guardians.skipped++; continue }
      const created = g.created_at || new Date().toISOString()
      const updated = g.updated_at || created
      const result = await client.query(
        `insert into guardians(id, user_id, name, phone_e164, notes, created_at, updated_at)
         values($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           name=excluded.name,
           phone_e164=excluded.phone_e164,
           notes=excluded.notes,
           updated_at=excluded.updated_at
         where guardians.user_id = excluded.user_id
         returning xmax = 0 as inserted`,
        [g.id, req.user.id, g.name, g.phone_e164, g.notes || null, created, updated]
      )
      if (!result.rowCount) { stats.guardians.skipped++; continue }
      if (result.rows[0]?.inserted) stats.guardians.inserted++
      else stats.guardians.updated++
    }

    for (const gs of importedGuardianStudents) {
      if (!gs?.id || !gs?.guardian_id || !gs?.student_id) { stats.guardianStudents.skipped++; continue }
      const ownedG = await client.query(
        'select 1 from guardians where id=$1 and user_id=$2',
        [gs.guardian_id, req.user.id]
      )
      const ownedS = await client.query(
        'select 1 from students where id=$1 and user_id=$2',
        [gs.student_id, req.user.id]
      )
      if (!ownedG.rows.length || !ownedS.rows.length) { stats.guardianStudents.skipped++; continue }
      const result = await client.query(
        `insert into guardian_students(id, guardian_id, student_id, relationship, is_primary, notify_on_result, notify_weekly_attendance)
         values($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           relationship=excluded.relationship,
           is_primary=excluded.is_primary,
           notify_on_result=excluded.notify_on_result,
           notify_weekly_attendance=excluded.notify_weekly_attendance
         returning xmax = 0 as inserted`,
        [gs.id, gs.guardian_id, gs.student_id, gs.relationship || null, !!gs.is_primary, !!gs.notify_on_result, !!gs.notify_weekly_attendance]
      )
      if (!result.rowCount) { stats.guardianStudents.skipped++; continue }
      if (result.rows[0]?.inserted) stats.guardianStudents.inserted++
      else stats.guardianStudents.updated++
    }

    for (const gt of importedGuardianTelegram) {
      if (!gt?.guardian_id || gt.telegram_chat_id == null) { stats.guardianTelegram.skipped++; continue }
      const ownedG = await client.query(
        'select 1 from guardians where id=$1 and user_id=$2',
        [gt.guardian_id, req.user.id]
      )
      if (!ownedG.rows.length) { stats.guardianTelegram.skipped++; continue }
      const result = await client.query(
        `insert into guardian_telegram(guardian_id, telegram_chat_id, telegram_username, linked_at, opt_out)
         values($1,$2,$3,$4,$5)
         on conflict (guardian_id) do update set
           telegram_chat_id=excluded.telegram_chat_id,
           telegram_username=excluded.telegram_username,
           linked_at=excluded.linked_at,
           opt_out=excluded.opt_out
         returning xmax = 0 as inserted`,
        [
          gt.guardian_id,
          gt.telegram_chat_id,
          gt.telegram_username || null,
          gt.linked_at || new Date().toISOString(),
          !!gt.opt_out,
        ]
      )
      if (!result.rowCount) { stats.guardianTelegram.skipped++; continue }
      if (result.rows[0]?.inserted) stats.guardianTelegram.inserted++
      else stats.guardianTelegram.updated++
    }

    // Save photos and update photo_url
    const nowTs = Date.now()
    for (const [studentId, encoded] of Object.entries(photos)) {
      if (!studentId || typeof encoded !== 'object') continue
      const studentDir = path.join(uploadsRoot, 'students', studentId)
      try { fs.mkdirSync(studentDir, { recursive: true }) } catch {}
      let savedAny = false
      for (const size of ['128','256','512']) {
        const dataUri = encoded[size]
        if (!dataUri || typeof dataUri !== 'string') continue
        try {
          const base64 = dataUri.includes('base64,') ? dataUri.split('base64,').pop() : dataUri
          const buf = Buffer.from(base64, 'base64')
          fs.writeFileSync(path.join(studentDir, `avatar-${size}.jpg`), buf)
          savedAny = true
        } catch (e) {
          console.error('[backup/import] failed to write photo', studentId, size, e?.message)
        }
      }
      if (savedAny) {
        stats.photos.saved++
        const photoUrl = `/uploads/students/${studentId}/avatar-256.jpg?v=${nowTs}`
        await client.query(
          `update students set photo_url=$1, updated_at=now() where id=$2 and user_id=$3`,
          [photoUrl, studentId, req.user.id]
        )
      }
    }

    await client.query('commit')
    return res.json({ ok: true, stats })
  } catch (e) {
    await client.query('rollback')
    console.error('[backup/import] error', e?.message)
    return res.status(500).json({ error: 'failed to import backup' })
  } finally {
    client.release()
  }
})

export default router
