import express, { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

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

    const userQ = await pool.query('select id, username, email, created_at from users where id=$1', [req.user.id])
    const user = userQ.rows[0] || null

    const studentsQ = await pool.query(
      `select id, number, name, current_naqza, photo_url, date_of_birth, created_at, updated_at
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

    const photos = {}
    if (includePhotos) {
      for (const s of students) {
        const encoded = readAvatarBase64(s.id)
        if (encoded) photos[s.id] = encoded
      }
    }

    const payload = {
      version: 'halaqa-backup-v1',
      exportedAt: new Date().toISOString(),
      user,
      counts: { students: students.length, sessions: sessions.length, photos: Object.keys(photos).length },
      students,
      sessions,
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
  if (!payload || payload.version !== 'halaqa-backup-v1') {
    return res.status(400).json({ error: 'invalid or unsupported backup version' })
  }
  const students = Array.isArray(payload.students) ? payload.students : []
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
  const photos = payload.photos && typeof payload.photos === 'object' ? payload.photos : {}

  const stats = {
    students: { inserted: 0, updated: 0, skipped: 0, conflicts: 0 },
    sessions: { inserted: 0, updated: 0, skipped: 0, conflicts: 0 },
    photos: { saved: 0 }
  }

  const client = await pool.connect()
  try {
    await client.query('begin')

    // Upsert students scoped to current user
    for (const s of students) {
      if (!s?.id || !s?.name || !s?.number) { stats.students.skipped++; continue }
      const created = s.created_at || new Date().toISOString()
      const updated = s.updated_at || created
      const photoUrl = s.photo_url || null
      const dob = s.date_of_birth || null
      const result = await client.query(
        `insert into students(id, user_id, number, name, current_naqza, photo_url, date_of_birth, created_at, updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (id) do update set
           number=excluded.number,
           name=excluded.name,
           current_naqza=excluded.current_naqza,
           photo_url=excluded.photo_url,
           date_of_birth=excluded.date_of_birth,
           updated_at=excluded.updated_at
         where students.user_id = excluded.user_id
         returning xmax = 0 as inserted`,
        [s.id, req.user.id, s.number, s.name, s.current_naqza ?? 1, photoUrl, dob, created, updated]
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
      const result = await client.query(
        `insert into sessions(
           id, student_id, week_start_date, attempt_day, mode, selected_naqza, selected_juz,
           selected_five_hizb, selected_quran_quarter, selected_quran_half,
           thumun_id, surah_number, hizb, juz, naqza, fatha_prompts, taradud_count, passed, score,
           attempt_at, created_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,
           $8,$9,$10,
           $11,$12,$13,$14,$15,$16,$17,$18,$19,
           $20,$21
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
           attempt_at=excluded.attempt_at
         where exists (
           select 1 from students st
           where st.id = sessions.student_id and st.user_id = $22
         )
         and exists (
           select 1 from students st
           where st.id = excluded.student_id and st.user_id = $22
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
          sess.attempt_at || created,
          created,
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

