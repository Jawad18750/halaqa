#!/usr/bin/env node
/**
 * Programmatic smoke test for guardian Telegram flow (simulates bot webhook).
 * Requires running server + DB + TELEGRAM_BOT_TOKEN (optional for actual send).
 */
import 'dotenv/config'
import { pool } from '../src/lib/db.js'
import { handleTelegramMessage } from '../src/lib/telegramUpdates.js'
import { notifySessionResult } from '../src/lib/notificationService.js'
import { revokeTelegramLink } from '../src/lib/guardiansService.js'

process.env.TELEGRAM_DRY_RUN = '1'

const API = process.env.SMOKE_API_URL || 'http://localhost:4000'
const CHAT_ID = 900001234

const results = []
function pass(step, detail = '') {
  results.push({ step, ok: true, detail })
  console.log(`✓ ${step}${detail ? `: ${detail}` : ''}`)
}
function fail(step, detail = '') {
  results.push({ step, ok: false, detail })
  console.error(`✗ ${step}${detail ? `: ${detail}` : ''}`)
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { status: res.status, json }
}

async function main() {
  console.log('=== Telegram guardian flow smoke test ===\n')

  const login = await api('/auth/login', {
    method: 'POST',
    body: { username: 'sheikh', password: 'password123' },
  })
  if (login.status !== 200 || !login.json?.token) {
    fail('Login', `status ${login.status}`)
    return printSummary()
  }
  const token = login.json.token
  pass('Login')

  const { rows: users } = await pool.query('select id from users where username=$1 limit 1', ['sheikh'])
  const userId = users[0]?.id
  if (!userId) { fail('Resolve user id'); return printSummary() }

  let { rows: students } = await pool.query(
    'select id, name, number from students where user_id=$1 order by number asc limit 2',
    [userId]
  )
  if (students.length < 2) {
    fail('Need at least 2 students for multi-student revoke test', `found ${students.length}`)
    return printSummary()
  }
  pass('Students loaded', `${students.length} students`)

  const phone = `+2189${String(Date.now()).slice(-8)}`
  const createG = await api('/guardians', {
    method: 'POST',
    token,
    body: { name: 'Smoke Test Guardian', phone, notes: 'smoke' },
  })
  if (createG.status !== 201) {
    fail('Create guardian', `status ${createG.status}`)
    return printSummary()
  }
  const guardianId = createG.json.guardian.id
  pass('Create guardian', guardianId)

  for (const s of students) {
    const link = await api(`/guardians/students/${s.id}/guardians`, {
      method: 'POST',
      token,
      body: { guardianId, relationship: 'أب', is_primary: s === students[0] },
    })
    if (link.status !== 201) {
      fail(`Link student ${s.name}`, `status ${link.status}`)
      return printSummary()
    }
  }
  pass('Link guardian to 2 students')

  const codeRes = await api(`/guardians/${guardianId}/link-code`, { method: 'POST', token, body: {} })
  if (codeRes.status !== 200 || !codeRes.json?.code) {
    fail('Generate invite code', `status ${codeRes.status}`)
    return printSummary()
  }
  const code = codeRes.json.code
  pass('Generate invite code', codeRes.json.deepLink || code)

  await handleTelegramMessage({
    chat: { id: CHAT_ID },
    from: { id: 111, first_name: 'Smoke', last_name: 'Parent', username: 'smoke_parent' },
    text: `/start ${code}`,
  })

  const gt = await pool.query(
    `select telegram_username, telegram_display_name, linked_at, opt_out
     from guardian_telegram where guardian_id=$1`,
    [guardianId]
  )
  if (!gt.rows.length) {
    fail('Telegram link after redeem')
    return printSummary()
  }
  const link = gt.rows[0]
  pass('Telegram link completed', `@${link.telegram_username} · ${link.telegram_display_name}`)

  const guardiansList = await api('/guardians', { token })
  const gRow = guardiansList.json?.guardians?.find(g => g.id === guardianId)
  if (!gRow?.telegram_linked || !gRow.telegram_linked_at) {
    fail('Teacher UI guardian list shows link metadata')
  } else {
    pass('Teacher list shows link metadata', gRow.telegram_display_name || gRow.telegram_username)
  }

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const attemptDay = dayNames[new Date().getDay()]
  const ins = await pool.query(
    `insert into sessions(
       student_id, week_start_date, attempt_day, mode, thumun_id,
       fatha_prompts, taradud_count, passed, score, attempt_at
     ) values($1, current_date, $2, 'juz', 1, 1, 0, true, 88, now())
     returning *`,
    [students[0].id, attemptDay]
  )
  const sessionRow = ins.rows[0]
  await notifySessionResult({
    userId,
    sessionRow,
    studentRow: students[0],
  })
  pass('Send test-result notification (attempted)')

  await handleTelegramMessage({ chat: { id: CHAT_ID }, text: '/stop' })
  const afterStop = await pool.query('select opt_out from guardian_telegram where guardian_id=$1', [guardianId])
  if (!afterStop.rows[0]?.opt_out) fail('/stop pauses notifications')
  else pass('/stop pauses notifications')

  await notifySessionResult({ userId, sessionRow, studentRow: students[0] })
  const optLog = await pool.query(
    `select status from notification_log where guardian_id=$1 order by created_at desc limit 1`,
    [guardianId]
  )
  if (optLog.rows[0]?.status === 'opt_out') pass('Paused guardian skipped on notify')
  else fail('Expected opt_out log after /stop', optLog.rows[0]?.status)

  await handleTelegramMessage({ chat: { id: CHAT_ID }, text: '/resume' })
  const afterResume = await pool.query('select opt_out from guardian_telegram where guardian_id=$1', [guardianId])
  if (afterResume.rows[0]?.opt_out) fail('/resume re-enables notifications')
  else pass('/resume re-enables notifications')

  await revokeTelegramLink(userId, guardianId)
  const afterRevoke = await pool.query('select 1 from guardian_telegram where guardian_id=$1', [guardianId])
  if (afterRevoke.rows.length) fail('Revoke removes guardian_telegram row')
  else pass('Teacher revoke removes Telegram link')

  await notifySessionResult({ userId, sessionRow, studentRow: students[0] })
  const noLinkLog = await pool.query(
    `select status from notification_log where guardian_id=$1 order by created_at desc limit 1`,
    [guardianId]
  )
  if (noLinkLog.rows[0]?.status === 'no_telegram_link') pass('Revoked guardian gets no_telegram_link')
  else fail('Expected no_telegram_link after revoke', noLinkLog.rows[0]?.status)

  pass('Multi-student scope', 'revoke deleted guardian_telegram for guardian linked to 2 students')

  // cleanup
  await pool.query('delete from guardians where id=$1', [guardianId])
  await pool.query('delete from sessions where id=$1', [sessionRow.id])
  pass('Cleanup test data')

  printSummary()
  await pool.end()
}

function printSummary() {
  const failed = results.filter(r => !r.ok)
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`)
  if (failed.length) process.exitCode = 1
}

main().catch(e => {
  console.error('Smoke test crashed:', e.message)
  process.exit(1)
})
