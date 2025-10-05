import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()
router.use(requireAuth)

// Multer storage to uploads/students
const uploadDir = path.resolve(path.join(process.cwd(), 'src', 'uploads', 'students'))
fs.mkdirSync(uploadDir, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, _file, cb) => cb(null, `${req.params.id}.jpg`)
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg','image/png'].includes(file.mimetype)
    cb(ok ? null : new Error('invalid file type'), ok)
  }
})

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'select id, number, name, current_naqza, photo_url, date_of_birth, created_at, updated_at from students where user_id=$1 order by number asc',
    [req.user.id]
  )
  res.json({ students: rows })
})

router.post('/', async (req, res) => {
  const { number, name } = req.body || {}
  if (!number || !name) return res.status(400).json({ error: 'number and name are required' })
  try {
    const { rows } = await pool.query(
      `insert into students(user_id, number, name)
       values($1, $2, $3)
       returning id, number, name, current_naqza, created_at, updated_at`,
      [req.user.id, number, name]
    )
    res.status(201).json({ student: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'number already used' })
    res.status(500).json({ error: 'failed to create student' })
  }
})

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { number, name, current_naqza, date_of_birth, photo_url } = req.body || {}
  try {
    console.log('[students.patch]', id, req.body)
    const fields = []
    const vals = []
    let idx = 1
    if (number !== undefined) { fields.push(`number=$${idx++}`); vals.push(number) }
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name) }
    if (current_naqza !== undefined) { fields.push(`current_naqza=$${idx++}`); vals.push(current_naqza) }
    if (date_of_birth !== undefined) { fields.push(`date_of_birth=$${idx++}`); vals.push(date_of_birth || null) }
    if (photo_url !== undefined) { fields.push(`photo_url=$${idx++}`); vals.push(photo_url || null) }
    if (!fields.length) return res.status(400).json({ error: 'no fields to update' })
    vals.push(req.user.id); vals.push(id)
    const { rows } = await pool.query(
      `update students set ${fields.join(', ')}, updated_at=now() where user_id=$${idx++} and id=$${idx++} returning id, number, name, current_naqza, photo_url, date_of_birth, created_at, updated_at`,
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

// Upload student photo (jpeg/png ≤ 2MB)
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  const { id } = req.params
  try {
    console.log('[students.photo] hit', id, 'file?', !!req.file)
    const rel = `/uploads/students/${id}.jpg`
    const { rows } = await pool.query(
      `update students set photo_url=$1, updated_at=now() where id=$2 and user_id=$3 returning id, number, name, current_naqza, photo_url, date_of_birth, created_at, updated_at`,
      [rel, id, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    res.json({ student: rows[0] })
  } catch (e) {
    res.status(400).json({ error: e.message || 'upload failed' })
  }
})

export default router

