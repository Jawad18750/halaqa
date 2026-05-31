import { deleteWebhook, getUpdates, isTelegramConfigured } from './telegramBot.js'
import { handleTelegramUpdate } from './telegramUpdates.js'

let running = false
let abortController = null

async function pollLoop() {
  let offset = 0

  while (running) {
    try {
      const updates = await getUpdates({
        offset,
        timeout: 25,
        signal: abortController?.signal,
      })

      for (const update of updates) {
        offset = update.update_id + 1
        try {
          await handleTelegramUpdate(update)
        } catch (e) {
          console.error('[telegram] poll handle error', e.message)
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || !running) break
      console.error('[telegram] poll error', e.message)
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

export async function startTelegramPolling() {
  if (running) return
  if (!isTelegramConfigured()) return

  running = true
  abortController = new AbortController()

  try {
    await deleteWebhook()
    console.log('[telegram] webhook cleared — using long polling for local dev')
  } catch (e) {
    console.warn('[telegram] deleteWebhook failed (may be ok):', e.message)
  }

  pollLoop().catch(e => console.error('[telegram] poll loop exited', e.message))
}

export function stopTelegramPolling() {
  running = false
  abortController?.abort()
  abortController = null
}
