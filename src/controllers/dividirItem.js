import { puedeRol } from '../permisos/resolver.js'

const EN_ANALISIS = ['Para analisis', 'En analisis', 'Pedido', 'Para revision']

/**
 * Liberar parte de un ítem, por cantidad (26/09/2026).
 *
 * El analista autoriza unas unidades y el resto se separa en otro ítem del
 * mismo pedido, igual que la compra parcial del comprador (op.controller.js):
 * así cada ítem sigue teniendo una sola cantidad y un solo estado. El resto
 * queda pendiente, en análisis y en blanco, o rechazado con su motivo. El
 * ítem original baja su cantidad y sigue en análisis: su estado lo cambia
 * después el PUT de siempre, junto con el análisis.
 *
 * Es la misma función para Berdina y San Pablo: cambia solo el modelo.
 */
export const dividirItem = (Model) => async (req, res) => {
  try {
    const rol = req.usuario?.rol
    if (rol !== 'superadmin' && !(await puedeRol(rol, 'compras.analista', 'editar'))) {
      return res.status(403).json({ error: 'Separar cantidades es del analista.' })
    }

    const { cant, resto, usuario } = req.body
    const accion = resto?.accion === 'rechazar' ? 'rechazar' : 'pendiente'
    const motivo = String(resto?.motivo || '').trim()

    const pedido = await Model.findById(req.params.id)
    const item = pedido?.items.id(req.params.itemId)
    if (!item) return res.status(404).json({ error: 'Pedido o ítem no encontrado.' })
    if (!EN_ANALISIS.includes(item.estado)) {
      return res.status(409).json({ error: `El ítem está en "${item.estado}": solo se separa mientras está en análisis.` })
    }

    const pedida = item.cant
    const libera = Number(cant)
    if (typeof pedida !== 'number' || !Number.isInteger(libera) || libera < 1 || libera >= pedida) {
      return res.status(400).json({ error: `La cantidad a liberar tiene que ser un entero entre 1 y ${(pedida || 1) - 1}.` })
    }
    if (accion === 'rechazar' && !motivo) {
      return res.status(400).json({ error: 'Falta el motivo del rechazo del resto.' })
    }

    const queda = pedida - libera
    const estado = accion === 'rechazar' ? 'Rechazado' : 'Para analisis'
    const ahora = new Date()
    const quien = usuario || 'Analista'

    const copia = item.toObject()
    delete copia._id
    delete copia.oc
    delete copia.apuro
    pedido.items.push({
      ...copia,
      cant: queda,
      estado,
      // El resto pendiente se analiza de nuevo, en blanco: si heredaba los
      // precios salía tildado para liberar en la próxima tanda.
      stock: null,
      proveedor1: null,
      precio1: null,
      proveedor2: null,
      precio2: null,
      proveedor3: null,
      precio3: null,
      elegido: null,
      observaciones: null,
      historial: [
        ...(copia.historial || []),
        {
          estado,
          usuario: quien,
          fecha: ahora,
          nota:
            accion === 'rechazar'
              ? `Rechazo parcial del analista: ${queda} de ${pedida} · ${motivo}`
              : `Saldo en análisis: ${queda} de ${pedida} (se liberaron ${libera})`,
        },
      ],
    })

    item.cant = libera
    item.historial.push({
      estado: item.estado,
      usuario: quien,
      fecha: ahora,
      nota: `Liberación parcial: ${libera} de ${pedida}; ${queda} ${accion === 'rechazar' ? 'rechazadas' : 'siguen en análisis'}`,
    })

    await pedido.save()
    res.json(pedido)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
