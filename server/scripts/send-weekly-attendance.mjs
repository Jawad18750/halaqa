#!/usr/bin/env node
import 'dotenv/config'
import { pool } from '../src/lib/db.js'
import { sendWeeklyAttendanceNotifications } from '../src/lib/notificationService.js'
import { addDays, getWeekStartSaturday } from '../src/lib/attendanceService.js'
import { todayInHalaqaTimeZone } from '../src/lib/halaqaCalendar.js'

function argValue(name) {
  const prefix = `--${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length).trim() : ''
}

function defaultPreviousWeekRange() {
  const currentStart = getWeekStartSaturday(todayInHalaqaTimeZone())
  const from = addDays(currentStart, -7)
  return { from, to: addDays(from, 6) }
}

async function loadUsers() {
  const userId = argValue('user-id')
  const username = argValue('username')
  if (userId) {
    const { rows } = await pool.query('select id, username from users where id=$1', [userId])
    return rows
  }
  if (username) {
    const { rows } = await pool.query('select id, username from users where username=$1', [username])
    return rows
  }
  const { rows } = await pool.query('select id, username from users order by username asc')
  return rows
}

async function main() {
  const defaults = defaultPreviousWeekRange()
  const from = argValue('from') || defaults.from
  const to = argValue('to') || defaults.to
  const users = await loadUsers()
  if (!users.length) {
    console.log('[attendance-weekly] no users matched')
    return
  }

  console.log(`[attendance-weekly] sending range ${from} → ${to}`)
  for (const user of users) {
    const result = await sendWeeklyAttendanceNotifications({ userId: user.id, from, to })
    console.log(`[attendance-weekly] ${user.username}:`, result)
  }
}

main()
  .catch(e => {
    console.error('[attendance-weekly] failed', e)
    process.exitCode = 1
  })
  .finally(() => pool.end())
