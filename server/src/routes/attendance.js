import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { getCalendarSettings, getCalendarStatus, todayInHalaqaTimeZone } from '../lib/halaqaCalendar.js'
import { buildAttendanceOverview } from '../lib/attendanceService.js'

const router = Router()
router.use(requireAuth)

function todayString() {
  return todayInHalaqaTimeZone()
}

function normalizeDate(input) {
  const value = String(input || todayString()).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayString()
}

router.get('/today', async (req, res) => {
  try {
    const date = normalizeDate(req.query.date)
    const settings = await getCalendarSettings(req.user.id)
    const calendar = getCalendarStatus(date, settings)
    const studentsQ = await pool.query(
      `select id, number, name, current_naqza, photo_url, date_of_birth, qr_token, created_at, updated_at
       from students where user_id=$1 order by number asc`,
      [req.user.id]
    )
    const recordsQ = await pool.query(
      `select ar.id, ar.student_id, ar.attendance_date, ar.recorded_at, ar.source, st.number as student_number, st.name as student_name
       from attendance_records ar
       join students st on st.id = ar.student_id
       where st.user_id=$1 and ar.attendance_date=$2::date
       order by ar.recorded_at desc`,
      [req.user.id, date]
    )
    res.json({ date, calendar, students: studentsQ.rows, records: recordsQ.rows })
  } catch (e) {
    console.error('[attendance.today] error', e?.message)
    res.status(500).json({ error: 'failed to load attendance' })
  }
})

router.get('/overview', async (req, res) => {
  try {
    const overview = await buildAttendanceOverview(req.user.id, {
      from: req.query.from,
      to: req.query.to,
    })
    res.json(overview)
  } catch (e) {
    console.error('[attendance.overview] error', e?.message)
    res.status(500).json({ error: 'failed to load attendance overview' })
  }
})

router.get('/stickers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, number, name, qr_token
       from students where user_id=$1 order by number asc`,
      [req.user.id]
    )
    res.json({ students: rows })
  } catch (e) {
    console.error('[attendance.stickers] error', e?.message)
    res.status(500).json({ error: 'failed to load stickers' })
  }
})

router.post('/batch', async (req, res) => {
  const date = normalizeDate(req.body?.date)
  const scans = Array.isArray(req.body?.scans) ? req.body.scans : []
  if (!scans.length) return res.status(400).json({ error: 'scans are required' })

  const saved = []
  const duplicates = []
  const invalid = []
  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const scan of scans) {
      const qrToken = String(scan?.qrToken || scan?.qr_token || '').trim()
      const source = scan?.source === 'manual' ? 'manual' : 'qr'
      if (!qrToken) {
        invalid.push({ qrToken, reason: 'empty' })
        continue
      }
      const studentQ = await client.query(
        'select id, number, name from students where user_id=$1 and qr_token=$2',
        [req.user.id, qrToken]
      )
      const student = studentQ.rows[0]
      if (!student) {
        invalid.push({ qrToken, reason: 'not_found' })
        continue
      }
      const result = await client.query(
        `insert into attendance_records(student_id, attendance_date, source)
         values($1, $2::date, $3)
         on conflict (student_id, attendance_date) do nothing
         returning id, student_id, attendance_date, recorded_at, source`,
        [student.id, date, source]
      )
      if (result.rows[0]) {
        saved.push({ ...result.rows[0], student_number: student.number, student_name: student.name })
      } else {
        duplicates.push({ student_id: student.id, student_number: student.number, student_name: student.name })
      }
    }
    await client.query('commit')
    res.status(201).json({ date, saved, duplicates, invalid })
  } catch (e) {
    await client.query('rollback')
    console.error('[attendance.batch] error', e?.message)
    res.status(500).json({ error: 'failed to save attendance' })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `delete from attendance_records ar
       using students st
       where ar.student_id = st.id and st.user_id=$1 and ar.id=$2`,
      [req.user.id, req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'not found' })
    res.status(204).end()
  } catch (e) {
    console.error('[attendance.delete] error', e?.message)
    res.status(500).json({ error: 'failed to remove attendance' })
  }
})

export default router
