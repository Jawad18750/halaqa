import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { pool } from './lib/db.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import sessionRoutes from './routes/sessions.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('select 1 as ok')
    res.json({ ok: true, db: r.rows[0].ok === 1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.use('/auth', authRoutes)
app.use('/students', studentRoutes)
app.use('/sessions', sessionRoutes)

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Halaqa server listening on http://localhost:${port}`)
})

