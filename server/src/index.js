import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { pool } from './lib/db.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import sessionRoutes from './routes/sessions.js'
import backupRoutes from './routes/backup.js'
import guardianRoutes from './routes/guardians.js'
import telegramRoutes from './routes/telegram.js'
import notificationRoutes from './routes/notifications.js'
import { registerWebhookOnStartup, isTelegramConfigured, getWebhookInfo } from './lib/telegramBot.js'
import { startTelegramPolling, stopTelegramPolling } from './lib/telegramPolling.js'
import { normalizeGuardianPhonesInDb } from './lib/guardiansService.js'

const app = express()

// Strict CORS: allow localhost during dev and the production front-end domain
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://halaqa.abdeljawad.com'
])
function isAllowedOrigin(origin) {
  if (!origin) return true // allow non-browser clients
  try { return allowedOrigins.has(origin) } catch { return false }
}
const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Telegram-Bot-Api-Secret-Token'],
  maxAge: 86400,
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
// Ensure Vary header for proper caching behavior on proxies
app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next() })
app.use(express.json())

// Static serving for uploaded images
import path from 'path'
import fs from 'fs'
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'src', 'uploads')
try { fs.mkdirSync(uploadsRoot, { recursive: true }) } catch {}
app.use('/uploads', express.static(uploadsRoot, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
}))

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

app.get('/status', async (req, res) => {
  const startedAt = Date.now()
  let db = false
  let dbError = null
  let dbLatencyMs = null
  let stats = null

  try {
    const dbStart = Date.now()
    const r = await pool.query('select 1 as ok')
    dbLatencyMs = Date.now() - dbStart
    db = r.rows[0].ok === 1
  } catch (e) {
    dbError = e.message
  }

  if (db) {
    try {
      const { rows } = await pool.query(`
        select
          (select count(*)::int from users) as users,
          (select count(*)::int from students) as students,
          (select count(*)::int from sessions) as sessions,
          (select count(*)::int from guardians) as guardians,
          (select count(*)::int from guardian_telegram) as guardians_telegram_linked,
          (select count(*)::int from notification_log where created_at > now() - interval '24 hours') as notifications_24h
      `)
      stats = rows[0]
    } catch (e) {
      stats = { error: e.message }
    }
  }

  let telegram = {
    configured: isTelegramConfigured(),
    botUsername: (process.env.TELEGRAM_BOT_USERNAME || 'Halaqa_Test_bot').replace(/^@/, ''),
    mode: null,
    webhookUrl: null,
    pendingUpdates: null,
    lastError: null,
  }

  const usePolling = ['1', 'true'].includes(String(process.env.TELEGRAM_USE_POLLING || '').toLowerCase())
  if (telegram.configured) {
    telegram.mode = usePolling ? 'polling' : 'webhook'
    if (!usePolling) {
      try {
        const info = await getWebhookInfo()
        telegram.webhookUrl = info.url || null
        telegram.pendingUpdates = info.pending_update_count ?? null
        telegram.lastError = info.last_error_message || null
        if (!info.url) telegram.mode = 'webhook_missing'
      } catch (e) {
        telegram.lastError = e.message
        telegram.mode = 'webhook_error'
      }
    }
  } else {
    telegram.mode = 'disabled'
  }

  const mem = process.memoryUsage()
  const ok = db
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'halaqa-api',
    db,
    dbError,
    dbLatencyMs,
    stats,
    uptimeSeconds: Math.floor(process.uptime()),
    version: '0.1.0',
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    urls: {
      frontend: process.env.PUBLIC_FRONTEND_URL || 'https://halaqa.abdeljawad.com',
      api: process.env.PUBLIC_API_URL || 'https://api.halaqa.abdeljawad.com',
      status: `${process.env.PUBLIC_FRONTEND_URL || 'https://halaqa.abdeljawad.com'}/status`,
    },
    telegram,
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  })
})

app.use('/auth', authRoutes)
app.use('/students', studentRoutes)
app.use('/sessions', sessionRoutes)
app.use('/backup', backupRoutes)
app.use('/guardians', guardianRoutes)
app.use('/notifications', notificationRoutes)
app.use('/telegram', telegramRoutes)

// 404 handler for API routes to help debug missing endpoints
app.use((req, res, next) => {
  const prefixes = ['/auth', '/students', '/sessions', '/guardians', '/notifications', '/telegram', '/backup']
  if (prefixes.some(p => req.path.startsWith(p))) {
    return res.status(404).type('text/plain').send(`Not Found: ${req.method} ${req.path}`)
  }
  next()
})

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
  normalizeGuardianPhonesInDb()
    .then((result) => {
      if (result.updated || result.merged) {
        console.log('[guardians] normalized phone numbers', result)
      }
    })
    .catch((e) => console.error('[guardians] phone normalize failed', e.message))
  registerWebhookOnStartup()
    .then(mode => {
      if (mode === 'polling') {
        return startTelegramPolling()
      }
    })
    .catch(e => console.error('[telegram] startup', e.message))
})

process.on('SIGTERM', () => stopTelegramPolling())
process.on('SIGINT', () => stopTelegramPolling())

