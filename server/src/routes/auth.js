import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
import { pool } from '../lib/db.js'
import { getUserSettings, updateUserSettings } from '../lib/userSettings.js'
import { invalidateUnusedPasswordResets, PASSWORD_RESET_TTL_MS } from '../lib/passwordReset.js'

const router = Router()

// In-memory rate limiter for auth endpoints (per-IP, per-route, fixed window).
const authRateStore = new Map()
function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
  return xff || req.ip || 'unknown'
}
function createAuthRateLimit({ key, windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now()
    const ip = getClientIp(req)
    const bucketKey = `${key}:${ip}`
    const current = authRateStore.get(bucketKey)

    if (!current || current.expiresAt <= now) {
      authRateStore.set(bucketKey, { count: 1, expiresAt: now + windowMs })
      return next()
    }

    if (current.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'عدد محاولات كبير، حاول لاحقا' })
    }

    current.count += 1
    authRateStore.set(bucketKey, current)
    next()
  }
}

router.post(
  '/register',
  createAuthRateLimit({ key: 'auth:register', windowMs: 15 * 60 * 1000, max: 20 }),
  async (req, res) => {
    const { username, password, email } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' })
    try {
      const hash = await bcrypt.hash(password, 10)
      const { rows } = await pool.query(
        'insert into users(username, password_hash, email) values($1,$2,$3) returning id, username, email, sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides',
        [username, hash, email || null]
      )
      const token = jwt.sign({ sub: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' })
      const user = await getUserSettings(rows[0].id)
      res.json({ token, user })
    } catch (e) {
      if (String(e.message).includes('unique')) return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' })
      res.status(500).json({ error: 'تعذر إنشاء الحساب' })
    }
  }
)

router.post(
  '/login',
  createAuthRateLimit({ key: 'auth:login', windowMs: 15 * 60 * 1000, max: 40 }),
  async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' })
  const { rows } = await pool.query(
    'select id, username, password_hash from users where username=$1 or email=$1',
    [username]
  )
  if (!rows.length) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
  const ok = await bcrypt.compare(password, rows[0].password_hash)
  if (!ok) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
  const token = jwt.sign({ sub: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  const user = await getUserSettings(rows[0].id)
  res.json({ token, user })
})

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await getUserSettings(payload.sub)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    res.json({ user })
  } catch {
    res.status(401).json({ error: 'غير مصرح' })
  }
})

router.patch('/settings', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides } = req.body || {}
    const user = await updateUserSettings(payload.sub, { sheikh_name, masjid_name, study_days, holiday_country, holiday_overrides })
    res.json({ user })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'تعذر حفظ الإعدادات' })
  }
})

export default router

// Forgot/reset endpoints (defined after export for clarity but part of same router)
const allowInvalidSmtpCerts = String(process.env.SMTP_ALLOW_INVALID_CERTS || '') === '1'
const transportOptions = {
  host: process.env.SMTP_HOST || 'abdeljawad.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || '') === '1',
  tls: { rejectUnauthorized: !allowInvalidSmtpCerts }
}
// Only set auth when BOTH user+pass exist. If not, omit auth completely (prevents "Missing credentials" errors).
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transportOptions.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}
const transporter = nodemailer.createTransport(transportOptions)

router.post(
  '/forgot',
  createAuthRateLimit({ key: 'auth:forgot', windowMs: 15 * 60 * 1000, max: 20 }),
  async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' })
    const u = await pool.query('select id, email, username from users where email=$1', [email])
    // Always respond success to avoid user enumeration
    if (!u.rows.length) return res.json({ ok: true })
    const user = u.rows[0]
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS)
    await invalidateUnusedPasswordResets(pool, user.id)
    await pool.query('insert into password_resets(user_id, token_hash, expires_at) values($1,$2,$3)', [user.id, tokenHash, expires.toISOString()])
    const base = process.env.RESET_BASE_URL || 'http://localhost:5173'
    const link = `${base}/reset?token=${token}`
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"اختبار القرآن" <noreply@example.com>',
        to: email,
        subject: 'إعادة تعيين كلمة المرور — حلقة',
        text: [
          'السلام عليكم،',
          'تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابكم في تطبيق حلقة.',
          'لإنشاء كلمة مرور جديدة، افتحوا الرابط التالي خلال ساعة واحدة:',
          link,
          'إذا لم تطلبوا إعادة تعيين كلمة المرور، يمكنكم تجاهل هذه الرسالة، ولن يتم تغيير كلمة المرور الحالية.',
          'فريق تطبيق حلقة',
        ].join('\n'),
      })
      res.json({ ok: true })
    } catch (mailErr) {
      console.error('[auth/forgot] mail send failed', mailErr?.message)
      // Keep response generic to avoid leaking reset link material.
      res.json({ ok: true })
    }
  } catch (e) {
    console.error('[auth/forgot] error', e?.message)
    // Fail-soft in dev/local to avoid blocking reset testing
    return res.json({ ok: true })
  }
})

router.post(
  '/reset',
  createAuthRateLimit({ key: 'auth:reset', windowMs: 15 * 60 * 1000, max: 20 }),
  async (req, res) => {
  try {
    const { token, password } = req.body || {}
    if (!token || !password) return res.status(400).json({ error: 'رمز الاستعادة وكلمة المرور مطلوبان' })
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const r = await pool.query('select * from password_resets where token_hash=$1 and used_at is null and expires_at > now() order by created_at desc limit 1', [tokenHash])
    if (!r.rows.length) return res.status(400).json({ error: 'رمز غير صالح أو منتهي' })
    const reset = r.rows[0]
    const hash = await bcrypt.hash(password, 10)
    await pool.query('update users set password_hash=$1 where id=$2', [hash, reset.user_id])
    await pool.query('update password_resets set used_at=now() where id=$1', [reset.id])
    res.json({ ok: true })
  } catch (e) {
    console.error('[auth/reset] error', e?.message)
    res.status(500).json({ error: 'تعذر إعادة التعيين' })
  }
})
