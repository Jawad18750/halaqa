import { Router } from 'express'
import { pool } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { getThumunById } from '../lib/thumunData.js'

const router = Router()
router.use(requireAuth)

function getWeekStartSaturday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun ... 6 Sat
  const diff = (day + 1) % 7 // days since last Saturday
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0,10)
}

router.post('/', async (req, res) => {
  try {
    console.log('[sessions] incoming body', req.body)
    const { studentId, mode, selectedNaqza, selectedJuz, thumunId } = req.body || {}
    let { fathaPrompts, taradudCount } = req.body || {}
    if (!studentId || !mode || !thumunId) {
      return res.status(400).json({ error: 'missing required fields' })
    }
    if (!['naqza','juz'].includes(mode)) return res.status(400).json({ error: 'invalid mode' })

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
    const weekday = now.getDay() // 0 Sun ... 6 Sat
    // التقييد في قاعدة البيانات يسمح بالسبت/الأحد فقط
    const attemptDay = (weekday === 0) ? 'sun' : 'sat'

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
            thumun_id, surah_number, hizb, juz, naqza, fatha_prompts, taradud_count, passed, score
          ) values (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,$12,$13,$14,$15
          ) returning *`,
          [
            studentId, weekStart, attemptDay, mode, selectedNaqza ?? null, selectedJuz ?? null,
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
      console.error('[sessions] insert failed', e?.message)
      return res.status(504).json({ error: 'session save timeout or failed', details: e?.message || '' })
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

export default router

