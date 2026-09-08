import { Router } from 'express'
import { getAll, crear, actualizarItem, borrarItem, ping, getHistorialItem, getItemsPorEstado, getHistorialGerencia } from '../controllers/berdinaPedido.controller.js'

const router = Router()
router.get('/ping', ping)
router.get('/historial-gerencia', getHistorialGerencia)
router.get('/por-estado/:estado', getItemsPorEstado)
router.get('/', getAll)
router.post('/', crear)
router.get('/:id/items/:itemId/historial', getHistorialItem)
router.put('/:id/items/:itemId', actualizarItem)
router.delete('/:id/items/:itemId', borrarItem)

export default router
