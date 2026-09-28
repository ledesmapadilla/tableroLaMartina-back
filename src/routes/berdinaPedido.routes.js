import { Router } from 'express'
import { dividirItem } from '../controllers/dividirItem.js'
import BerdinaPedido from '../models/BerdinaPedido.js'
import { getAll, crear, actualizarItem, borrarItem, ping, getHistorialItem, getById, getItemsPorEstado, getHistorialGerencia } from '../controllers/berdinaPedido.controller.js'

const router = Router()
router.get('/ping', ping)
router.get('/historial-gerencia', getHistorialGerencia)
router.get('/por-estado/:estado', getItemsPorEstado)
router.get('/', getAll)
router.post('/', crear)
router.get('/:id', getById)
router.get('/:id/items/:itemId/historial', getHistorialItem)
router.put('/:id/items/:itemId', actualizarItem)
// Liberar parte de un ítem por cantidad; va por PUT porque el POST de
// pedidos es solo del taller (index.routes.js).
router.put('/:id/items/:itemId/dividir', dividirItem(BerdinaPedido))
router.delete('/:id/items/:itemId', borrarItem)

export default router
