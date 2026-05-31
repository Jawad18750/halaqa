import 'dotenv/config'
import { pool } from '../src/lib/db.js'

const userId = process.env.RANDOMIZE_USER_ID || '1ec2099a-b034-40d1-9454-d54e1e44ce06'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function main() {
  const guardians = (await pool.query(
    'select id, name, phone_e164 from guardians where user_id=$1 order by phone_e164',
    [userId]
  )).rows

  const students = (await pool.query(
    'select id, number, name from students where user_id=$1 order by number',
    [userId]
  )).rows

  if (!guardians.length || !students.length) {
    console.error('No guardians or students found')
    process.exit(1)
  }

  const shuffled = shuffle(students)
  const families = []
  let i = 0
  while (i < shuffled.length) {
    const remaining = shuffled.length - i
    let size = remaining <= 4 ? remaining : 2 + Math.floor(Math.random() * 3)
    if (remaining - size === 1) size += 1
    families.push(shuffled.slice(i, i + size))
    i += size
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      'delete from guardian_students where guardian_id in (select id from guardians where user_id=$1)',
      [userId]
    )
    await client.query(
      'delete from family_students where family_id in (select id from families where user_id=$1)',
      [userId]
    )
    await client.query('delete from families where user_id=$1', [userId])

    let famIdx = 0
    for (const familyStudents of families) {
      famIdx += 1
      const { rows: famRows } = await client.query(
        'insert into families(user_id, name) values($1, $2) returning id',
        [userId, `عائلة ${famIdx}`]
      )
      const familyId = famRows[0].id

      for (const s of familyStudents) {
        await client.query(
          'insert into family_students(family_id, student_id) values($1, $2)',
          [familyId, s.id]
        )
      }

      const guardianCount = Math.random() < 0.35 ? 1 : Math.min(2, guardians.length)
      const familyGuardians = shuffle(guardians).slice(0, guardianCount)

      for (const s of familyStudents) {
        for (let g = 0; g < familyGuardians.length; g++) {
          const gRow = familyGuardians[g]
          await client.query(
            `insert into guardian_students(guardian_id, student_id, relationship, is_primary, notify_on_result)
             values($1, $2, $3, $4, true)`,
            [gRow.id, s.id, g === 0 ? 'ولي أساسي' : 'ولي أمر', g === 0]
          )
        }
      }
    }

    await client.query('commit')

    const summary = await pool.query(
      `select g.name, g.phone_e164, count(gs.student_id)::int as students
       from guardians g
       left join guardian_students gs on gs.guardian_id = g.id
       where g.user_id = $1
       group by g.id
       order by g.phone_e164`,
      [userId]
    )
    console.log('Guardian coverage:')
    for (const r of summary.rows) {
      console.log(`  ${r.name} (${r.phone_e164}): ${r.students} students`)
    }

    const famSummary = await pool.query(
      `select f.name, count(fs.student_id)::int as n
       from families f
       join family_students fs on fs.family_id = f.id
       where f.user_id = $1
       group by f.id
       order by f.name`,
      [userId]
    )
    console.log(`\n${famSummary.rows.length} families created`)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
