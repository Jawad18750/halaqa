import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { pool } from '../lib/db.js'
import { loadThumunData } from '../lib/thumunData.js'

const STUDENT_COUNT = 30
const WEEKS_OF_HISTORY = 72
const DEMO_USERNAME = 'sheikh'
const DEMO_EMAIL = 'sheikh@demo.local'
const DEMO_PASSWORD = 'password123'

const SEED_DEMO = process.env.SEED_DEMO === '1'
const SEED_DEMO_PHOTOS = process.env.SEED_DEMO_PHOTOS === '1'
const ALLOW_DEMO_SEED = process.env.ALLOW_DEMO_SEED === '1'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'src', 'uploads')
const studentsUploadsRoot = path.join(uploadsRoot, 'students')

const ARABIC_NAMES = [
  'محمد أحمد الفيتوري', 'عبدالله سالم الزاوي', 'يوسف عمر المصراتي', 'إbrahim خالد القاضي',
  'عمر حسن الشريف', 'سالم عبدالرحمن', 'مصطفى نور الدين', 'حسين علي البوسيفي',
  'أنس محمود الترهوني', 'كريم فتحي الجهمي', 'بلal رمضان', 'طارق سعيد البرعصي',
  'زيad منصور', 'رامي عادل', 'وليد كمال', 'سامي جمال',
  'فadi ناصر', 'هani بشir', 'مajed سلim', 'نabil عثman',
  'قasem حمد', 'رashid فوزي', 'عادل منير', 'جmal صالح',
  'بshir لutfi', 'حakim رضا', 'سif الدين', 'مروan عيسى',
  'إlyas حاتم', 'يasin برnis',
]

const MODES = [
  { mode: 'naqza', weight: 70 },
  { mode: 'juz', weight: 12 },
  { mode: 'five_hizb', weight: 8 },
  { mode: 'quarter', weight: 5 },
  { mode: 'half', weight: 3 },
  { mode: 'full', weight: 2 },
]

const ATTEMPT_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed']

function pad2(n) { return String(n).padStart(2, '0') }

function formatLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function getWeekStartSaturday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 1) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - diff)
  return formatLocalDate(d)
}

function attemptDayFromDate(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date).getDay()]
}

function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item.mode
  }
  return items[0].mode
}

function computeScore(passed, fatha, taradud) {
  const fathaPenaltyTier = fatha >= 3 ? 30 : fatha === 2 ? 20 : fatha === 1 ? 10 : 0
  const hesitationPenalty = Math.min(10, Math.max(0, taradud - 3))
  if (passed) {
    const s = 100 - (fathaPenaltyTier + hesitationPenalty)
    return Math.max(60, Math.min(100, s))
  }
  const failBase = 59 - (Math.max(0, fatha - 4) * 5) - Math.min(20, taradud)
  return Math.max(0, Math.min(59, failBase))
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickThumun(thumuns, { mode, naqza, juz }) {
  let pool_ = thumuns
  if (mode === 'naqza' && naqza) pool_ = thumuns.filter(t => t.naqza === naqza)
  else if (mode === 'juz' && juz) pool_ = thumuns.filter(t => t.juz === juz)
  if (!pool_.length) pool_ = thumuns
  return pool_[randomInt(0, pool_.length - 1)]
}

function randomBirthDate() {
  const year = randomInt(2008, 2016)
  const month = randomInt(1, 12)
  const day = randomInt(1, 28)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function sessionTimestamp(weekStartStr, attemptDay) {
  const base = new Date(`${weekStartStr}T00:00:00`)
  const dayIndex = { sat: 0, sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6 }
  base.setDate(base.getDate() + (dayIndex[attemptDay] ?? 0))
  base.setHours(randomInt(9, 18), randomInt(0, 59), randomInt(0, 59), 0)
  return base
}

async function ensureDemoUser() {
  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const { rows } = await pool.query(
    `insert into users(username, password_hash, email)
     values($1, $2, $3)
     on conflict (username) do update
       set password_hash = excluded.password_hash,
           email = excluded.email
     returning id, username, email`,
    [DEMO_USERNAME, password_hash, DEMO_EMAIL]
  )
  const user = rows[0]
  if (user.username !== DEMO_USERNAME) {
    throw new Error('demo user identity mismatch')
  }
  return user.id
}

async function verifyDemoUser(userId) {
  const { rows } = await pool.query(
    'select id, username, email from users where id = $1',
    [userId]
  )
  const user = rows[0]
  if (!user || user.username !== DEMO_USERNAME) {
    throw new Error('refusing demo seed: target user is not the demo account')
  }
}

function assertDemoSeedEnvironment() {
  if (!SEED_DEMO) {
    console.error('[seed] refused: demo seed requires SEED_DEMO=1')
    console.error('  example: SEED_DEMO=1 SEED_DEMO_PHOTOS=1 npm run seed')
    process.exit(1)
  }
  if (IS_PRODUCTION && !ALLOW_DEMO_SEED) {
    console.error('[seed] refused in production without ALLOW_DEMO_SEED=1')
    process.exit(1)
  }
}

async function clearDemoData(userId) {
  await pool.query(
    `delete from sessions
     where student_id in (select id from students where user_id = $1)`,
    [userId]
  )
}

async function upsertStudents(userId) {
  const students = []
  for (let n = 1; n <= STUDENT_COUNT; n++) {
    const name = ARABIC_NAMES[n - 1] || `طالب ${n}`
    const startNaqza = randomInt(8, 20)
    const dob = randomBirthDate()
    const qrToken = crypto.randomUUID().replace(/-/g, '')
    const { rows } = await pool.query(
      `insert into students(user_id, number, name, current_naqza, date_of_birth, qr_token)
       values($1, $2, $3, $4, $5, $6)
       on conflict (user_id, number) do update
         set name = excluded.name,
             date_of_birth = excluded.date_of_birth,
             current_naqza = excluded.current_naqza,
             qr_token = coalesce(students.qr_token, excluded.qr_token)
       returning id, number, name`,
      [userId, n, name, startNaqza, dob, qrToken]
    )
    students.push({ ...rows[0], startNaqza, currentNaqza: startNaqza })
  }
  return students
}

function buildSessionsForStudent(student, thumuns) {
  const sessions = []
  const now = new Date()
  let currentNaqza = student.startNaqza
  let lastThumunId = null

  for (let w = WEEKS_OF_HISTORY; w >= 0; w--) {
    const weekDate = new Date(now)
    weekDate.setDate(weekDate.getDate() - w * 7)
    const weekStart = getWeekStartSaturday(weekDate)

    const attemptsThisWeek = Math.random() < 0.08 ? 0 : randomInt(1, 3)
    for (let a = 0; a < attemptsThisWeek; a++) {
      const attemptDay = ATTEMPT_DAYS[randomInt(0, ATTEMPT_DAYS.length - 1)]
      const mode = pickWeighted(MODES)
      const selectedNaqza = currentNaqza
      const selectedJuz = mode === 'juz' ? randomInt(1, 30) : null
      const selectedFiveHizb = mode === 'five_hizb' ? randomInt(1, 12) : null
      const selectedQuranQuarter = mode === 'quarter' ? randomInt(1, 4) : null
      const selectedQuranHalf = mode === 'half' ? randomInt(1, 2) : null

      let thumun = pickThumun(thumuns, {
        mode,
        naqza: selectedNaqza ?? currentNaqza,
        juz: selectedJuz,
      })
      if (thumun.id === lastThumunId && thumuns.length > 1) {
        thumun = thumuns[(thumuns.indexOf(thumun) + 1) % thumuns.length]
      }
      lastThumunId = thumun.id

      const failChance = 0.22
      const fathaPrompts = Math.random() < failChance
        ? randomInt(4, 6)
        : randomInt(0, 3)
      const taradudCount = randomInt(0, 8)
      const passed = fathaPrompts < 4
      const score = computeScore(passed, fathaPrompts, taradudCount)
      const attemptAt = sessionTimestamp(weekStart, attemptDay)

      if (passed) currentNaqza = Math.min(20, currentNaqza + 1)

      sessions.push({
        studentId: student.id,
        weekStart,
        attemptDay,
        mode,
        selectedNaqza,
        selectedJuz,
        selectedFiveHizb,
        selectedQuranQuarter,
        selectedQuranHalf,
        thumun,
        fathaPrompts,
        taradudCount,
        passed,
        score,
        attemptAt,
      })
    }
  }

  return { sessions, finalNaqza: currentNaqza }
}

function avatarSourceUrls(studentNumber) {
  const img = ((studentNumber - 1) % 70) + 1
  const gender = studentNumber % 2 === 0 ? 'women' : 'men'
  const portrait = ((studentNumber - 1) % 99) + 1
  return [
    `https://i.pravatar.cc/512?img=${img}`,
    `https://randomuser.me/api/portraits/${gender}/${portrait}.jpg`,
    `https://picsum.photos/seed/halaqa-student-${studentNumber}/512`,
  ]
}

async function fetchAvatarBuffer(studentNumber) {
  for (const url of avatarSourceUrls(studentNumber)) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'QuranTester-Seed/1.0' },
      })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 500) continue
      return buf
    } catch {
      // try next source
    }
  }
  return null
}

async function saveStudentAvatar(demoUserId, studentId, buffer) {
  const owned = await pool.query(
    'select id from students where id = $1 and user_id = $2',
    [studentId, demoUserId]
  )
  if (!owned.rows.length) {
    throw new Error('refusing photo write: student does not belong to demo user')
  }

  const studentDir = path.join(studentsUploadsRoot, studentId)
  fs.mkdirSync(studentDir, { recursive: true })

  const base = sharp(buffer, { limitInputPixels: 268402689 })
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'cover', position: 'centre', withoutEnlargement: true })
    .withMetadata({ orientation: 1 })

  fs.writeFileSync(
    path.join(studentDir, 'avatar-512.jpg'),
    await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(512, 512).toBuffer()
  )
  fs.writeFileSync(
    path.join(studentDir, 'avatar-256.jpg'),
    await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(256, 256).toBuffer()
  )
  fs.writeFileSync(
    path.join(studentDir, 'avatar-128.jpg'),
    await base.clone().jpeg({ quality: 82, mozjpeg: true }).resize(128, 128).toBuffer()
  )

  const photoUrl = `/uploads/students/${studentId}/avatar-256.jpg?v=${Date.now()}`
  await pool.query(
    'update students set photo_url = $1, updated_at = now() where id = $2 and user_id = $3',
    [photoUrl, studentId, demoUserId]
  )
  return photoUrl
}

async function assertDemoStudents(demoUserId, students) {
  if (!students.length) return
  const ids = students.map(s => s.id)
  const { rows } = await pool.query(
    'select count(*)::int as n from students where user_id = $1 and id = any($2::uuid[])',
    [demoUserId, ids]
  )
  if (rows[0].n !== students.length) {
    throw new Error('refusing photo seed: students are not all owned by the demo user')
  }
}

async function seedDemoStudentPhotos(demoUserId, students) {
  await verifyDemoUser(demoUserId)
  await assertDemoStudents(demoUserId, students)

  fs.mkdirSync(studentsUploadsRoot, { recursive: true })
  let saved = 0
  let failed = 0

  for (const student of students) {
    const buffer = await fetchAvatarBuffer(student.number)
    if (!buffer) {
      failed++
      console.warn(`[seed]   photo skipped: #${student.number} ${student.name}`)
      continue
    }
    try {
      await saveStudentAvatar(demoUserId, student.id, buffer)
      saved++
      console.log(`[seed]   photo ${saved}/${students.length}: #${student.number}`)
    } catch (e) {
      failed++
      console.warn(`[seed]   photo failed: #${student.number}`, e?.message)
    }
  }

  return { saved, failed }
}

async function insertSessionBatch(batch) {
  if (!batch.length) return
  const cols = 20
  const values = []
  const params = []
  batch.forEach((s, i) => {
    const o = i * cols
    values.push(
      `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14},$${o + 15},$${o + 16},$${o + 17},$${o + 18},$${o + 19},$${o + 20})`
    )
    params.push(
      s.studentId,
      s.weekStart,
      s.attemptDay,
      s.mode,
      s.selectedNaqza,
      s.selectedJuz,
      s.selectedFiveHizb,
      s.selectedQuranQuarter,
      s.selectedQuranHalf,
      s.thumun.id,
      s.thumun.surahNumber ?? null,
      s.thumun.hizb ?? null,
      s.thumun.juz ?? null,
      s.thumun.naqza ?? null,
      s.fathaPrompts,
      s.taradudCount,
      s.passed,
      s.score,
      s.attemptAt.toISOString(),
      s.attemptAt.toISOString()
    )
  })

  await pool.query(
    `insert into sessions(
       student_id, week_start_date, attempt_day, mode,
       selected_naqza, selected_juz, selected_five_hizb, selected_quran_quarter, selected_quran_half,
       thumun_id, surah_number, hizb, juz, naqza,
       fatha_prompts, taradud_count, passed, score,
       attempt_at, created_at
     ) values ${values.join(',')}`,
    params
  )
}

async function main() {
  assertDemoSeedEnvironment()

  console.log('[seed] loading thumun data…')
  const { list: thumuns } = loadThumunData()

  console.log('[seed] ensuring demo user…')
  const userId = await ensureDemoUser()
  await verifyDemoUser(userId)

  console.log('[seed] clearing old demo sessions…')
  await clearDemoData(userId)

  console.log(`[seed] creating ${STUDENT_COUNT} students…`)
  const students = await upsertStudents(userId)

  if (SEED_DEMO_PHOTOS) {
    console.log('[seed] fetching demo profile photos (external URLs)…')
    const { saved, failed } = await seedDemoStudentPhotos(userId, students)
    console.log(`[seed] photos: ${saved} saved${failed ? `, ${failed} skipped` : ''}`)
  } else {
    console.log('[seed] skipping demo photos (set SEED_DEMO_PHOTOS=1 to fetch fake avatars)')
  }

  let allSessions = []
  const finalNaqzaByStudent = new Map()

  console.log(`[seed] generating ~${WEEKS_OF_HISTORY} weeks of sessions per student…`)
  for (const student of students) {
    const { sessions, finalNaqza } = buildSessionsForStudent(student, thumuns)
    allSessions.push(...sessions)
    finalNaqzaByStudent.set(student.id, finalNaqza)
  }

  console.log(`[seed] inserting ${allSessions.length} sessions…`)
  const BATCH = 200
  for (let i = 0; i < allSessions.length; i += BATCH) {
    await insertSessionBatch(allSessions.slice(i, i + BATCH))
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= allSessions.length) {
      console.log(`[seed]   ${Math.min(i + BATCH, allSessions.length)} / ${allSessions.length}`)
    }
  }

  console.log('[seed] updating student naqza levels…')
  for (const [studentId, naqza] of finalNaqzaByStudent) {
    await pool.query(
      'update students set current_naqza = $1, updated_at = now() where id = $2',
      [naqza, studentId]
    )
  }

  const { rows: stats } = await pool.query(
    `select
       (select count(*) from students where user_id = $1) as students,
       (select count(*) from students where user_id = $1 and photo_url is not null) as with_photos,
       (select count(*) from sessions s join students st on st.id = s.student_id where st.user_id = $1) as sessions,
       (select count(*) from sessions s join students st on st.id = s.student_id where st.user_id = $1 and s.passed) as passed,
       (select count(*) from sessions s join students st on st.id = s.student_id where st.user_id = $1 and not s.passed) as failed`,
    [userId]
  )

  console.log('[seed] complete')
  console.log(`  login: ${DEMO_USERNAME} / ${DEMO_PASSWORD}`)
  console.log(`  students: ${stats[0].students} (${stats[0].with_photos} with photos)`)
  console.log(`  sessions: ${stats[0].sessions} (${stats[0].passed} passed, ${stats[0].failed} failed)`)
  process.exit(0)
}

main().catch(e => {
  console.error('[seed] failed', e)
  process.exit(1)
})
