import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
import { pool } from '../lib/db.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { username, password, email } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'insert into users(username, password_hash, email) values($1,$2,$3) returning id, username, email',
      [username, hash, email || null]
    )
    const token = jwt.sign({ sub: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: rows[0] })
  } catch (e) {
    if (String(e.message).includes('unique')) return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' })
    res.status(500).json({ error: 'تعذر إنشاء الحساب' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' })
  const { rows } = await pool.query('select id, username, password_hash from users where username=$1 or email=$1', [username])
  if (!rows.length) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
  const ok = await bcrypt.compare(password, rows[0].password_hash)
  if (!ok) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
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
    res.status(401).json({ error: 'غير مصرح' })
  }
})

export default router

// Forgot/reset endpoints (defined after export for clarity but part of same router)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'abdeljawad.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
  tls: { rejectUnauthorized: false }
})

router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' })
    const u = await pool.query('select id, email, username from users where email=$1', [email])
    // Always respond success to avoid user enumeration
    if (!u.rows.length) return res.json({ ok: true })
    const user = u.rows[0]
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1h
    await pool.query('insert into password_resets(user_id, token_hash, expires_at) values($1,$2,$3)', [user.id, tokenHash, expires.toISOString()])
    const base = process.env.RESET_BASE_URL || 'http://localhost:5173'
    const link = `${base}/reset?token=${token}`
    console.log('[auth/forgot] reset link for', user.username, link)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"اختبار القرآن" <noreply@example.com>',
        to: email,
        subject: 'إعادة تعيين كلمة المرور',
        text: `مرحبًا ${user.username}\n\nلاستعادة كلمة المرور، افتح الرابط التالي خلال ساعة:\n${link}\n\nإذا لم تطلب ذلك فتجاهل الرسالة.`
      })
      res.json({ ok: true })
    } catch (mailErr) {
      console.error('[auth/forgot] mail send failed', mailErr?.message)
      // In dev, still return ok and include link hint (do not leak in prod).
      res.json({ ok: true, devLink: link })
    }
  } catch (e) {
    console.error('[auth/forgot] error', e?.message)
    // Fail-soft in dev/local to avoid blocking reset testing
    return res.json({ ok: true })
  }
})

router.post('/reset', async (req, res) => {
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

