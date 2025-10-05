import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../lib/db.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'insert into users(username, password_hash) values($1,$2) returning id, username',
      [username, hash]
    )
    const token = jwt.sign({ sub: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'username already exists' })
    res.status(500).json({ error: 'failed to register' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
  const { rows } = await pool.query('select id, username, password_hash from users where username=$1', [username])
  if (!rows.length) return res.status(401).json({ error: 'invalid credentials' })
  const ok = await bcrypt.compare(password, rows[0].password_hash)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ sub: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: rows[0].id, username: rows[0].username } })
})

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('select id, username from users where id = $1', [payload.sub])
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized' })
    res.json({ user: rows[0] })
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

export default router

