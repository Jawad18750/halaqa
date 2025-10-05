import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { getThumunById } from '../lib/thumunData.js'

const router = Router()
router.use(requireAuth)

function pad2(n){ return String(n).padStart(2,'0') }
function formatLocalDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}
function getWeekStartSaturday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun ... 6 Sat
  const diff = (day + 1) % 7 // days since last Saturday
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - diff)
  return formatLocalDate(d)
}
function attemptDayFromDate(date = new Date()){
  const d = new Date(date)
  const day = d.getDay()
  return ['sun','mon','tue','wed','thu','fri','sat'][day]
}
function weekStartDateFrom(date){
  return getWeekStartSaturday(date)
}

router.post('/', async (req, res) => {
  try {
    console.log('[sessions] incoming body', req.body)
    const { studentId, mode, selectedNaqza, selectedJuz, thumunId, selectedFiveHizb, selectedQuranQuarter, selectedQuranHalf } = req.body || {}
    let { fathaPrompts, taradudCount } = req.body || {}
    if (!studentId || !mode || !thumunId) {
      return res.status(400).json({ error: 'missing required fields' })
    }
    if (!['naqza','juz','five_hizb','quarter','half','full'].includes(mode)) return res.status(400).json({ error: 'invalid mode' })

    // Validate ownership
    console.log(`[sessions] start user=${req.user?.id} student=${studentId}`)
    const s = await pool.query('select id from students where id=$1 and user_id=$2', [studentId, req.user.id])
    if (!s.rows.length) return res.status(404).json({ error: 'student not found' })

    // Enrich with thumun metadata
    const t = getThumunById(thumunId)
    if (!t) return res.status(400).json({ error: 'invalid thumunId' })

  // Normalize counters (allow more than 3 so 4/3 can be recorded, cap at 10)
  fathaPrompts = Math.max(0, Math.min(10, Number(fathaPrompts ?? 0)))
  taradudCount = Math.max(0, Number(taradudCount ?? 0))

  // Determine pass/fail strictly from Fatha prompts policy
  const passed = fathaPrompts < 4

  function computeScore(passedFlag, fatha, taradud) {
    // Option D base with guarantees:
    // - If passed (fatha <=3), score is in [60,100]
    // - If failed (fatha >=4), score is in [0,59]
    const fathaPenaltyTier = fatha >= 3 ? 30 : fatha === 2 ? 20 : fatha === 1 ? 10 : 0
    const hesitationPenalty = Math.min(10, Math.max(0, taradud - 3) * 1)
    if (passedFlag) {
      const s = 100 - (fathaPenaltyTier + hesitationPenalty)
      return Math.max(60, Math.min(100, s))
    }
    // Failed: derive a severity score below 60
    const failBase = 59 - ((Math.max(0, fatha - 4)) * 5) - Math.min(20, taradud)
    return Math.max(0, Math.min(59, failBase))
  }

    const computedScore = computeScore(passed, fathaPrompts, taradudCount)

    const now = new Date()
    const weekStart = getWeekStartSaturday(now)
    const attemptDay = attemptDayFromDate(now)

  function withTimeout(promise, ms, label) {
    let timeoutId
    const timed = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)
    })
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timed])
  }

    console.log(`[sessions] insert student=${studentId} day=${attemptDay} mode=${mode} thumun=${t.id} fatha=${fathaPrompts} taradud=${taradudCount} passed=${passed}`)
    let rows
    try {
      const result = await withTimeout(
        pool.query(
          `insert into sessions(
            student_id, week_start_date, attempt_day, mode, selected_naqza, selected_juz,
            selected_five_hizb, selected_quran_quarter, selected_quran_half,
            thumun_id, surah_number, hizb, juz, naqza, fatha_prompts, taradud_count, passed, score
          ) values (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,
            $10,$11,$12,$13,$14,$15,$16,$17,$18
          ) returning *`,
          [
            studentId, weekStart, attemptDay, mode, selectedNaqza ?? null, selectedJuz ?? null,
            Number(selectedFiveHizb) || null, Number(selectedQuranQuarter) || null, Number(selectedQuranHalf) || null,
            t.id, t.surahNumber ?? null, t.hizb ?? null, t.juz ?? null, t.naqza ?? null,
            fathaPrompts, taradudCount, passed, computedScore
          ]
        ),
        15000,
        'insert sessions'
      )
      rows = result.rows
      console.log(`[sessions] inserted id=${rows[0]?.id}`)
    } catch (e) {
      const msg = e?.message || ''
      console.error('[sessions] insert failed', msg)
      // Map common constraint errors to 400 for better client feedback
      if (/check constraint/i.test(msg) || /violates check constraint/i.test(msg)) {
        return res.status(400).json({ error: 'invalid session data', details: msg })
      }
      return res.status(504).json({ error: 'session save timeout or failed', details: msg })
    }

  // Progression: decrement current_naqza on every pass (no weekly restriction)
    if (passed) {
      try {
        await withTimeout(
          pool.query(
            `update students set current_naqza = greatest(1, current_naqza - 1), updated_at=now()
             where id=$1 and user_id=$2`,
            [studentId, req.user.id]
          ),
          15000,
          'update progression'
        )
        console.log(`[sessions] progression updated for student=${studentId}`)
      } catch (e) {
        console.error('[sessions] progression update failed', e?.message)
        return res.status(504).json({ error: 'progression update timeout or failed', details: e?.message || '' })
      }
    }

    return res.status(201).json({ session: rows[0] })
  } catch (e) {
    console.error('[sessions] unhandled', e)
    return res.status(500).json({ error: 'internal error', details: e?.message || '' })
  }
})
// TEST addding a comment
router.get('/student/:id', async (req, res) => {
  const { id } = req.params
  const owned = await pool.query('select id from students where id=$1 and user_id=$2', [id, req.user.id])
  if (!owned.rows.length) return res.status(404).json({ error: 'student not found' })
  const { rows } = await pool.query(
    `select * from sessions where student_id=$1 order by created_at desc`,
    [id]
  )
  res.json({ sessions: rows })
})

router.get('/weekly', async (req, res) => {
  const weekStart = getWeekStartSaturday()
  const { rows } = await pool.query(
    `select s.*, st.number as student_number, st.name as student_name
     from sessions s
     join students st on st.id = s.student_id
     where st.user_id=$1 and s.week_start_date=$2
     order by st.number asc, s.created_at desc`,
    [req.user.id, weekStart]
  )
  res.json({ weekStartDate: weekStart, sessions: rows })
})

// Edit attempt time within 30 days (owner only)
router.patch('/:id/time', async (req, res) => {
  try {
    const { id } = req.params
    const { attemptAt } = req.body || {}
    if (!attemptAt) return res.status(400).json({ error: 'attemptAt is required' })
    const newDt = new Date(attemptAt)
    if (isNaN(newDt)) return res.status(400).json({ error: 'invalid datetime' })
    const now = new Date()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    if (Math.abs(now.getTime() - newDt.getTime()) > THIRTY_DAYS) {
      return res.status(400).json({ error: 'edit window exceeded (30 days)' })
    }
    // Ownership check via join
    const owned = await pool.query(
      `select s.id from sessions s join students st on st.id=s.student_id where s.id=$1 and st.user_id=$2`,
      [id, req.user.id]
    )
    if (!owned.rows.length) return res.status(404).json({ error: 'not found' })
    const weekStart = weekStartDateFrom(newDt)
    const attemptDay = attemptDayFromDate(newDt)
    const { rows } = await pool.query(
      `update sessions set attempt_at=$1, week_start_date=$2, attempt_day=$3, updated_at=now() where id=$4 returning *`,
      [newDt.toISOString(), weekStart, attemptDay, id]
    )
    return res.json({ session: rows[0] })
  } catch (e) {
    console.error('[sessions.patch.time] error', e?.message)
    return res.status(500).json({ error: 'failed to update time' })
  }
})

// Overview by date range (inclusive from/to, local dates YYYY-MM-DD)
router.get('/overview', async (req, res) => {
  try {
    const today = new Date()
    const toStr = req.query.to || formatLocalDate(today)
    const fromDate = new Date(today)
    fromDate.setDate(fromDate.getDate() - 6)
    const fromStr = req.query.from || formatLocalDate(fromDate)
    // Use date range [from, to+1)
    const { rows } = await pool.query(
      `select s.*, st.number as student_number, st.name as student_name
       from sessions s
       join students st on st.id = s.student_id
       where st.user_id=$1
         and s.attempt_at >= $2::date
         and s.attempt_at < ($3::date + interval '1 day')
       order by s.attempt_at desc, st.number asc`,
      [req.user.id, fromStr, toStr]
    )
    return res.json({ from: fromStr, to: toStr, sessions: rows })
  } catch (e) {
    console.error('[sessions.overview] error', e)
    return res.status(500).json({ error: 'failed to load overview' })
  }
})

// Hard-delete a session
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { rowCount } = await pool.query(
      'delete from sessions using students where sessions.student_id=students.id and sessions.id=$1 and students.user_id=$2',
      [id, req.user.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'not found' })
    return res.status(204).end()
  } catch (e) {
    return res.status(500).json({ error: 'failed to delete session' })
  }
})

export default router

