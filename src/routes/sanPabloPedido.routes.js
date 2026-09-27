import { Router } from 'express'
import { dividirItem } from '../controllers/dividirItem.js'
import SanPabloPedido from '../models/SanPabloPedido.js'
import { getAll, crear, actualizarItem, borrarItem, ping, getHistorialItem, getItemsPorEstado, getHistorialGerencia } from '../controllers/sanPabloPedido.controller.js'

const router = Router()
router.get('/ping', ping)
router.get('/historial-gerencia', getHistorialGerencia)
router.get('/por-estado/:estado', getItemsPorEstado)
router.get('/', getAll)
router.post('/', crear)
router.get('/:id/items/:itemId/historial', getHistorialItem)
router.put('/:id/items/:itemId', actualizarItem)
// Liberar parte de un ítem por cantidad; va por PUT porque el POST de
// pedidos es solo del taller (index.routes.js).
router.put('/:id/items/:itemId/dividir', dividirItem(SanPabloPedido))
router.delete('/:id/items/:itemId', borrarItem)

export default router
