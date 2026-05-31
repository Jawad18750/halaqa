import { Router } from 'express'
import { handleTelegramUpdate } from '../lib/telegramUpdates.js'

const router = Router()

function verifySecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return false
  return req.headers['x-telegram-bot-api-secret-token'] === secret
}

router.post('/webhook', async (req, res) => {
  if (!verifySecret(req)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  try {
    await handleTelegramUpdate(req.body || {})
    res.json({ ok: true })
  } catch (e) {
    console.error('[telegram] webhook error', e.message)
    res.json({ ok: true })
  }
})

export default router
