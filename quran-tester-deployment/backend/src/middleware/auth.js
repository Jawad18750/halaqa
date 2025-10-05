import jwt from 'jsonwebtoken'
import { pool } from '../lib/db.js'

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('select id, username from users where id = $1', [payload.sub])
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized' })
    req.user = { id: rows[0].id, username: rows[0].username }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

