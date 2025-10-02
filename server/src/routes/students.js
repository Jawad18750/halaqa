import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'select id, number, name, notes, current_naqza, created_at, updated_at from students where user_id=$1 order by number asc',
    [req.user.id]
  )
  res.json({ students: rows })
})

router.post('/', async (req, res) => {
  const { number, name, notes } = req.body || {}
  if (!number || !name) return res.status(400).json({ error: 'number and name are required' })
  if (number < 1 || number > 30) return res.status(400).json({ error: 'number must be between 1 and 30' })
  try {
    const { rows } = await pool.query(
      `insert into students(user_id, number, name, notes)
       values($1, $2, $3, $4)
       returning id, number, name, notes, current_naqza, created_at, updated_at`,
      [req.user.id, number, name, notes || '']
    )
    res.status(201).json({ student: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'number already used' })
    res.status(500).json({ error: 'failed to create student' })
  }
})

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { number, name, notes, current_naqza } = req.body || {}
  try {
    const fields = []
    const vals = []
    let idx = 1
    if (number !== undefined) { fields.push(`number=$${idx++}`); vals.push(number) }
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name) }
    if (notes !== undefined) { fields.push(`notes=$${idx++}`); vals.push(notes) }
    if (current_naqza !== undefined) { fields.push(`current_naqza=$${idx++}`); vals.push(current_naqza) }
    if (!fields.length) return res.status(400).json({ error: 'no fields to update' })
    vals.push(req.user.id); vals.push(id)
    const { rows } = await pool.query(
      `update students set ${fields.join(', ')}, updated_at=now() where user_id=$${idx++} and id=$${idx++} returning id, number, name, notes, current_naqza, created_at, updated_at`,
      vals
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    res.json({ student: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'number already used' })
    res.status(500).json({ error: 'failed to update student' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const { rowCount } = await pool.query('delete from students where user_id=$1 and id=$2', [req.user.id, id])
  if (!rowCount) return res.status(404).json({ error: 'not found' })
  res.status(204).end()
})

export default router

