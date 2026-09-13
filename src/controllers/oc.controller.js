import OC from '../models/OC.js'
import BerdinaPedido from '../models/BerdinaPedido.js'
import SanPabloPedido from '../models/SanPabloPedido.js'

export const getAll = async (req, res) => {
  try {
    const ocs = await OC.find().sort({ createdAt: -1 })
    res.json(ocs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getByDisplay = async (req, res) => {
  try {
    const oc = await OC.findOne({ nro_oc_display: req.params.display })
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' })
    res.json(oc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * Aplica la compra de un ítem a su pedido (en memoria; el que llama guarda).
 *
 * El comprador puede comprar menos de lo pedido. El resto se separa en un
 * ítem nuevo del mismo pedido, con la misma descripción y el mismo análisis:
 * vuelve a "Para hacer OC" (queda pendiente para el comprador, sin volver a
 * Gerencia) o queda "Rechazado" con el motivo. Así cada ítem sigue teniendo
 * una sola cantidad y un solo estado, y ninguna pantalla tiene que saber de
 * compras parciales.
 */
const aplicarCompra = (pedido, ocItem, nroOC) => {
  const item = pedido.items.id(ocItem.itemId)
  if (!item) return
  const pedida = typeof item.cant === 'number' ? item.cant : null
  const comprada = Number(ocItem.cant)
  const parcial = pedida != null && Number.isInteger(comprada) && comprada >= 1 && comprada < pedida
  const ahora = new Date()

  if (parcial) {
    const resto = pedida - comprada
    const rechaza = ocItem.resto?.accion === 'rechazar'
    const motivo = String(ocItem.resto?.motivo || '').trim()
    const estado = rechaza ? 'Rechazado' : 'Para hacer OC'
    const copia = item.toObject()
    delete copia._id
    delete copia.oc
    pedido.items.push({
      ...copia,
      cant: resto,
      estado,
      historial: [
        ...(copia.historial || []),
        {
          estado,
          usuario: 'Comprador',
          fecha: ahora,
          nota: rechaza
            ? `Rechazo parcial: ${resto} de ${pedida}${motivo ? ` · ${motivo}` : ''}`
            : `Saldo pendiente: ${resto} de ${pedida} (compra parcial en ${nroOC})`,
        },
      ],
    })
    item.cant = comprada
  }

  item.estado = 'Para retirar'
  item.oc = nroOC
  item.historial.push({
    estado: 'Para retirar',
    usuario: 'Comprador',
    fecha: ahora,
    nota: parcial ? `OC generada: ${nroOC} · compra parcial: ${comprada} de ${pedida}` : `OC generada: ${nroOC}`,
  })
}

export const crear = async (req, res) => {
  try {
    const { items, total, establecimiento } = req.body
    if (!items || items.length === 0) return res.status(400).json({ error: 'La OC debe tener al menos un ítem.' })

    const prefijo = establecimiento === 'berdina' ? 'B' : establecimiento === 'sanpablo' ? 'SP' : 'MX'
    const last = await OC.findOne({ establecimiento }).sort({ nro_oc: -1 })
    const nro_oc = last?.nro_oc ? last.nro_oc + 1 : 1
    const nro_oc_display = `OC-${prefijo}-${String(nro_oc).padStart(3, '0')}`

    const oc = await new OC({ nro_oc, establecimiento, nro_oc_display, items, total }).save()

    // Los ítems de un mismo pedido se aplican juntos y el pedido se guarda una
    // sola vez: una compra parcial agrega un ítem, y dos guardados en paralelo
    // del mismo pedido se pisaban.
    const porPedido = new Map()
    for (const ocItem of items) {
      const clave = `${ocItem._src}-${ocItem.pedidoId}`
      if (!porPedido.has(clave)) porPedido.set(clave, [])
      porPedido.get(clave).push(ocItem)
    }
    await Promise.all(
      [...porPedido.values()].map(async (delPedido) => {
        const Model = delPedido[0]._src === 'berdina' ? BerdinaPedido : SanPabloPedido
        const pedido = await Model.findById(delPedido[0].pedidoId)
        if (!pedido) return
        delPedido.forEach((ocItem) => aplicarCompra(pedido, ocItem, nro_oc_display))
        await pedido.save()
      })
    )

    res.status(201).json(oc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
