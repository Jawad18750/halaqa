import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import multer from 'multer'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const router = Router()
router.use(requireAuth)

// Image upload setup
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'src', 'uploads')
try { fs.mkdirSync(uploadsRoot, { recursive: true }) } catch {}
const studentsRoot = path.join(uploadsRoot, 'students')
try { fs.mkdirSync(studentsRoot, { recursive: true }) } catch {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.mimetype)
    cb(ok ? null : new Error('invalid file type'), ok)
  }
})

const STUDENT_COLUMNS = 'id, number, name, current_naqza, memorization_thumun_id, memorization_surah, qalam_count, photo_url, date_of_birth, created_at, updated_at'

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `select ${STUDENT_COLUMNS} from students where user_id=$1 order by number asc`,
    [req.user.id]
  )
  res.json({ students: rows })
})

router.post('/', async (req, res) => {
  const { number, name } = req.body || {}
  if (!number || !name) return res.status(400).json({ error: 'number and name are required' })
  try {
    const qrToken = crypto.randomUUID().replace(/-/g, '')
    const { rows } = await pool.query(
      `insert into students(user_id, number, name, qr_token)
       values($1, $2, $3, $4)
       returning ${STUDENT_COLUMNS}`,
      [req.user.id, number, name, qrToken]
    )
    res.status(201).json({ student: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'number already used' })
    res.status(500).json({ error: 'failed to create student' })
  }
})

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { number, name, current_naqza, memorization_thumun_id, memorization_surah, qalam_count, date_of_birth, photo_url } = req.body || {}
  try {
    console.log('[students.patch]', id, req.body)
    const fields = []
    const vals = []
    let idx = 1
    if (number !== undefined) { fields.push(`number=$${idx++}`); vals.push(number) }
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name) }
    if (current_naqza !== undefined) { fields.push(`current_naqza=$${idx++}`); vals.push(current_naqza) }
    if (memorization_thumun_id !== undefined) {
      fields.push(`memorization_thumun_id=$${idx++}`)
      vals.push(memorization_thumun_id === '' || memorization_thumun_id == null ? null : Number(memorization_thumun_id))
    }
    if (memorization_surah !== undefined) {
      fields.push(`memorization_surah=$${idx++}`)
      vals.push(memorization_surah === '' || memorization_surah == null ? null : String(memorization_surah).trim())
    }
    if (qalam_count !== undefined) {
      const q = Number(qalam_count)
      fields.push(`qalam_count=$${idx++}`)
      vals.push(Number.isFinite(q) && q >= 1 ? Math.min(20, Math.floor(q)) : 1)
    }
    if (date_of_birth !== undefined) { fields.push(`date_of_birth=$${idx++}`); vals.push(date_of_birth || null) }
    if (photo_url !== undefined) { fields.push(`photo_url=$${idx++}`); vals.push(photo_url || null) }
    if (!fields.length) return res.status(400).json({ error: 'no fields to update' })
    vals.push(req.user.id); vals.push(id)
    const { rows } = await pool.query(
      `update students set ${fields.join(', ')}, updated_at=now() where user_id=$${idx++} and id=$${idx++} returning ${STUDENT_COLUMNS}`,
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

// Upload and process profile photo
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  const { id } = req.params
  const owned = await pool.query('select id from students where user_id=$1 and id=$2', [req.user.id, id])
  if (!owned.rows.length) return res.status(404).json({ error: 'not found' })
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  const studentDir = path.join(studentsRoot, id)
  try { fs.mkdirSync(studentDir, { recursive: true }) } catch {}

  try {
    const base = sharp(req.file.buffer, { limitInputPixels: 268402689 }) // ~16k x 16k guard
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'cover', position: 'centre', withoutEnlargement: true })
      .withMetadata({ orientation: 1 })

    // Generate sizes
    const out512 = await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(512, 512).toBuffer()
    const out256 = await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(256, 256).toBuffer()
    const out128 = await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(128, 128).toBuffer()

    fs.writeFileSync(path.join(studentDir, 'avatar-512.jpg'), out512)
    fs.writeFileSync(path.join(studentDir, 'avatar-256.jpg'), out256)
    fs.writeFileSync(path.join(studentDir, 'avatar-128.jpg'), out128)

    const baseUrl = `/uploads/students/${id}`
    const photoUrl = `${baseUrl}/avatar-256.jpg?v=${Date.now()}`
    const { rows } = await pool.query(
      `update students set photo_url=$1, updated_at=now() where id=$2 and user_id=$3
       returning ${STUDENT_COLUMNS}`,
      [photoUrl, id, req.user.id]
    )
    return res.json({
      ok: true,
      student: rows[0],
      files: {
        '128': `${baseUrl}/avatar-128.jpg`,
        '256': `${baseUrl}/avatar-256.jpg`,
        '512': `${baseUrl}/avatar-512.jpg`
      }
    })
  } catch (e) {
    console.error('[students.photo] error', e?.message)
    return res.status(500).json({ error: 'failed to process image' })
  }
})

export default router
