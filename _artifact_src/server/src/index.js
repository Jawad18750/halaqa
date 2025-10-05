import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { pool } from './lib/db.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import sessionRoutes from './routes/sessions.js'

const app = express()

// Strict CORS: allow localhost during dev and the production front-end domain
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://halaqa.abdeljawad.com'
])
function isAllowedOrigin(origin) {
  if (!origin) return true // allow non-browser clients
  try { return allowedOrigins.has(origin) } catch { return false }
}
const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge: 86400,
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
// Ensure Vary header for proper caching behavior on proxies
app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next() })
app.use(express.json())

// Minimal request logger to diagnose hangs
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.url}`)
  next()
})

app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('select 1 as ok')
    res.json({ ok: true, db: r.rows[0].ok === 1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.use('/auth', authRoutes)
app.use('/students', studentRoutes)
app.use('/sessions', sessionRoutes)

// Global error guard to always respond JSON and include CORS when possible
app.use((err, req, res, next) => {
  try {
    const origin = req.headers.origin
    if (isAllowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } catch {}
  console.error('[server] unhandled error', err)
  res.status(500).json({ error: 'internal server error' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Halaqa server listening on http://localhost:${port}`)
})

