import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../lib/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `)
}

async function getApplied() {
  const { rows } = await pool.query('select name from migrations order by id asc')
  return new Set(rows.map(r => r.name))
}

async function applyMigration(name, sql) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into migrations(name) values($1)', [name])
    await client.query('commit')
    console.log(`Applied: ${name}`)
  } catch (e) {
    await client.query('rollback')
    console.error(`Failed: ${name}`, e.message)
    process.exitCode = 1
  } finally {
    client.release()
  }
}

async function main() {
  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  await ensureMigrationsTable()
  const applied = await getApplied()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await applyMigration(file, sql)
  }
  console.log('Migrations complete')
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

