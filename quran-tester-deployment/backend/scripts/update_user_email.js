import 'dotenv/config'
import { pool } from '../src/lib/db.js'

async function main() {
  const [,, username, email] = process.argv
  if (!username || !email) {
    console.error('Usage: node scripts/update_user_email.js <username> <email>')
    process.exit(1)
  }
  const q = 'update users set email=$1 where username=$2 returning id, username, email'
  const { rows } = await pool.query(q, [email, username])
  console.log(rows[0] || 'no match')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })


