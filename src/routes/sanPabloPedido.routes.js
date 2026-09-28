import { Router } from 'express'
import { dividirItem } from '../controllers/dividirItem.js'
import { archivoPedido, PUEDEN_ADJUNTAR } from '../controllers/archivoPedido.js'
import { exigirEditar } from '../middleware/permisos.js'
import SanPabloPedido from '../models/SanPabloPedido.js'
import { getAll, crear, actualizarItem, borrarItem, ping, getHistorialItem, getById, getItemsPorEstado, getHistorialGerencia } from '../controllers/sanPabloPedido.controller.js'

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
router.put('/:id/items/:itemId/dividir', dividirItem(SanPabloPedido))
router.delete('/:id/items/:itemId', borrarItem)
// El adjunto del pedido entero (28/09/2026): lo sube o lo saca el mismo que
// adjunta en un ítem.
router.put('/:id/archivo', exigirEditar(PUEDEN_ADJUNTAR), archivoPedido(SanPabloPedido))

export default router
