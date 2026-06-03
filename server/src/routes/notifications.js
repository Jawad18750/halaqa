import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  broadcastMessage,
  getNotificationLog,
  sendWeeklyAttendanceNotifications,
  sendAttendanceOverviewReport,
} from '../lib/notificationService.js'
import { pool } from '../lib/db.js'

const router = Router()
router.use(requireAuth)

router.post('/broadcast', async (req, res) => {
  try {
    const { message, targetType, targetId, targetIds } = req.body || {}
    if (!message?.trim()) return res.status(400).json({ error: 'الرسالة مطلوبة' })
    if (!targetType) return res.status(400).json({ error: 'targetType مطلوب' })

    const result = await broadcastMessage({
      userId: req.user.id,
      message: message.trim(),
      targetType,
      targetId: targetId || null,
      targetIds: targetIds || null,
    })
    res.json(result)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'internal error' })
  }
})

router.post('/attendance-weekly', async (req, res) => {
  try {
    const result = await sendWeeklyAttendanceNotifications({
      userId: req.user.id,
      from: req.body?.from,
      to: req.body?.to,
    })
    res.json(result)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'internal error' })
  }
})

router.post('/attendance-overview-report', async (req, res) => {
  try {
    const result = await sendAttendanceOverviewReport({
      userId: req.user.id,
      from: req.body?.from,
      to: req.body?.to,
    })
    res.json(result)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'internal error' })
  }
})

router.get('/log', async (req, res) => {
  try {
    const limit = req.query.limit
    const studentId = req.query.studentId || null
    const entries = await getNotificationLog(req.user.id, { limit, studentId })
    res.json({ entries })
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

router.get('/families', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select f.id, f.name, f.created_at,
              coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'number', s.number))
                filter (where s.id is not null), '[]') as students
       from families f
       left join family_students fs on fs.family_id = f.id
       left join students s on s.id = fs.student_id
       where f.user_id = $1
       group by f.id
       order by f.name asc`,
      [req.user.id]
    )
    res.json({ families: rows })
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

router.post('/families', async (req, res) => {
  try {
    const { name, studentIds } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'اسم العائلة مطلوب' })

    const client = await pool.connect()
    try {
      await client.query('begin')
      const { rows } = await client.query(
        'insert into families(user_id, name) values($1, $2) returning id, name, created_at',
        [req.user.id, name.trim()]
      )
      const family = rows[0]

      const ids = Array.isArray(studentIds) ? studentIds : []
      for (const sid of ids) {
        const owned = await client.query(
          'select id from students where id=$1 and user_id=$2',
          [sid, req.user.id]
        )
        if (owned.rows.length) {
          await client.query(
            'insert into family_students(family_id, student_id) values($1, $2) on conflict do nothing',
            [family.id, sid]
          )
        }
      }
      await client.query('commit')
      res.status(201).json({ family })
    } catch (e) {
      await client.query('rollback')
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

router.delete('/families/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'delete from families where id=$1 and user_id=$2',
      [req.params.id, req.user.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'العائلة غير موجودة' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

export default router
