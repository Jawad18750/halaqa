const API_BASE = 'https://api.telegram.org'

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || ''
}

export function isTelegramConfigured() {
  return !!getToken()
}

async function telegramRequest(method, body) {
  const token = getToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    const err = new Error(data.description || `Telegram API error ${res.status}`)
    err.statusCode = res.status
    err.telegramErrorCode = data.error_code
    throw err
  }
  return data.result
}

export async function sendMessage(chatId, text, options = {}) {
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || undefined,
    disable_web_page_preview: true,
  })
}

export async function setWebhook(url, secretToken) {
  return telegramRequest('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message'],
  })
}

export async function deleteWebhook() {
  return telegramRequest('deleteWebhook', { drop_pending_updates: false })
}

export async function getUpdates({ offset = 0, timeout = 25, signal } = {}) {
  const token = getToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  const res = await fetch(`${API_BASE}/bot${token}/getUpdates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset,
      timeout,
      allowed_updates: ['message'],
    }),
    signal,
  })

  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    const err = new Error(data.description || `Telegram getUpdates error ${res.status}`)
    err.statusCode = res.status
    err.telegramErrorCode = data.error_code
    throw err
  }
  return data.result || []
}

export function shouldRetry(error) {
  const code = error.statusCode || 0
  const tgCode = error.telegramErrorCode || 0
  if (code === 429) return true
  if (code >= 500) return true
  if (tgCode === 429) return true
  return false
}

export async function registerWebhookOnStartup() {
  const token = getToken()
  const publicUrl = process.env.PUBLIC_API_URL?.trim()
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const forcePolling = String(process.env.TELEGRAM_USE_POLLING || '').toLowerCase() === '1'
    || String(process.env.TELEGRAM_USE_POLLING || '').toLowerCase() === 'true'

  if (!token) {
    console.log('[telegram] not configured (no TELEGRAM_BOT_TOKEN)')
    return 'disabled'
  }

  if (!forcePolling && publicUrl && secret) {
    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/telegram/webhook`
    try {
      await setWebhook(webhookUrl, secret)
      console.log('[telegram] webhook registered:', webhookUrl)
      return 'webhook'
    } catch (e) {
      console.error('[telegram] webhook registration failed', e.message)
      return 'webhook_failed'
    }
  }

  return 'polling'
}
