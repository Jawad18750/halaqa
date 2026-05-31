import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listGuardiansForUser,
  createGuardian,
  updateGuardian,
  deleteGuardian,
  listGuardiansForStudent,
  linkGuardianToStudent,
  updateGuardianLink,
  deleteGuardianLink,
  createLinkCode,
  revokeTelegramLink,
} from '../lib/guardiansService.js'

const router = Router()
router.use(requireAuth)

function handleError(res, e) {
  const status = e.status || 500
  const body = { error: e.message || 'internal error' }
  if (e.existingGuardianId) body.existingGuardianId = e.existingGuardianId
  return res.status(status).json(body)
}

router.get('/', async (req, res) => {
  try {
    const guardians = await listGuardiansForUser(req.user.id)
    res.json({ guardians })
  } catch (e) {
    handleError(res, e)
  }
})

router.post('/', async (req, res) => {
  try {
    const guardian = await createGuardian(req.user.id, req.body || {})
    res.status(201).json({ guardian })
  } catch (e) {
    handleError(res, e)
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const guardian = await updateGuardian(req.user.id, req.params.id, req.body || {})
    res.json({ guardian })
  } catch (e) {
    handleError(res, e)
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteGuardian(req.user.id, req.params.id)
    res.status(204).end()
  } catch (e) {
    handleError(res, e)
  }
})

router.post('/:id/link-code', async (req, res) => {
  try {
    const result = await createLinkCode(req.user.id, req.params.id)
    res.json(result)
  } catch (e) {
    handleError(res, e)
  }
})

router.delete('/:id/telegram', async (req, res) => {
  try {
    await revokeTelegramLink(req.user.id, req.params.id)
    res.json({ ok: true })
  } catch (e) {
    handleError(res, e)
  }
})

router.get('/students/:studentId/guardians', async (req, res) => {
  try {
    const guardians = await listGuardiansForStudent(req.user.id, req.params.studentId)
    res.json({ guardians })
  } catch (e) {
    handleError(res, e)
  }
})

router.post('/students/:studentId/guardians', async (req, res) => {
  try {
    const result = await linkGuardianToStudent(req.user.id, req.params.studentId, req.body || {})
    res.status(201).json(result)
  } catch (e) {
    handleError(res, e)
  }
})

router.patch('/links/:linkId', async (req, res) => {
  try {
    const link = await updateGuardianLink(req.user.id, req.params.linkId, req.body || {})
    res.json({ link })
  } catch (e) {
    handleError(res, e)
  }
})

router.delete('/links/:linkId', async (req, res) => {
  try {
    await deleteGuardianLink(req.user.id, req.params.linkId)
    res.status(204).end()
  } catch (e) {
    handleError(res, e)
  }
})

export default router
