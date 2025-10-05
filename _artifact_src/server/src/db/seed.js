import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../lib/db.js'

async function main() {
  const password_hash = await bcrypt.hash('password123', 10)
  const { rows } = await pool.query(
    'insert into users(username, password_hash) values($1, $2) on conflict (username) do update set username=excluded.username returning id',
    ['sheikh', password_hash]
  )
  const sheikhId = rows[0].id
  // Create sample students 1..5
  for (let n = 1; n <= 5; n++) {
    await pool.query(
      `insert into students(user_id, number, name, notes)
       values($1, $2, $3, $4)
       on conflict (user_id, number) do update set name=excluded.name`,
      [sheikhId, n, `طالب ${n}`, '']
    )
  }
  console.log('Seed complete')
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

