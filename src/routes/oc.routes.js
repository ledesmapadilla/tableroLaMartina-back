import { Router } from 'express'
import { getAll, getByDisplay, crear } from '../controllers/oc.controller.js'

const router = Router()
router.get('/', getAll)
router.get('/by-display/:display', getByDisplay)
router.post('/', crear)

export default router
