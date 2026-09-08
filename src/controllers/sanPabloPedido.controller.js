import SanPabloPedido from '../models/SanPabloPedido.js'

export const getAll = async (req, res) => {
  try {
    const pedidos = await SanPabloPedido.find({}, { 'items.historial': 0 }).sort({ nro_pedido: -1 })
    res.json(pedidos)
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack?.slice(0, 300) })
  }
}

export const getHistorialItem = async (req, res) => {
  try {
    const pedido = await SanPabloPedido.findOne(
      { _id: req.params.id, 'items._id': req.params.itemId },
      { 'items.$': 1 }
    )
    if (!pedido) return res.status(404).json({ error: 'No encontrado.' })
    res.json(pedido.items[0]?.historial || [])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const getItemsPorEstado = async (req, res) => {
  try {
    const { estado } = req.params
    const pedidos = await SanPabloPedido.find(
      { 'items.estado': estado },
      { nro_pedido: 1, fecha: 1, items: 1 }
    ).lean()
    const items = pedidos.flatMap(p =>
      p.items
        .filter(i => i.estado === estado)
        .map(({ historial: _, ...i }) => ({ ...i, nro_pedido: p.nro_pedido, fecha: p.fecha, pedidoId: p._id }))
    )
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const getHistorialGerencia = async (req, res) => {
  try {
    const pedidos = await SanPabloPedido.find(
      { 'items.historial.usuario': 'Gerencia' },
      { nro_pedido: 1, fecha: 1, items: 1 }
    ).lean()
    const resultado = pedidos.flatMap(p =>
      p.items
        .filter(i => i.historial?.some(h => h.usuario === 'Gerencia'))
        .map(i => ({
          _id: i._id,
          nombre_repuesto: i.nombre_repuesto,
          cant: i.cant,
          urgencia: i.urgencia,
          grupo: i.grupo,
          estado: i.estado,
          precio1: i.precio1,
          precio2: i.precio2,
          precio3: i.precio3,
          nro_pedido: p.nro_pedido,
          fecha: p.fecha,
          pedidoId: p._id,
          accionesGerencia: i.historial.filter(h => h.usuario === 'Gerencia'),
        }))
    ).sort((a, b) => {
      const fa = a.accionesGerencia.at(-1)?.fecha
      const fb = b.accionesGerencia.at(-1)?.fecha
      return new Date(fb) - new Date(fa)
    })
    res.json(resultado)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const ping = (req, res) => res.json({ ok: true, ts: Date.now() })

export const crear = async (req, res) => {
  try {
    const { fecha, items } = req.body
    if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria.' })
    if (!items || items.length === 0) return res.status(400).json({ error: 'El pedido debe tener al menos un ítem.' })
    for (const item of items) {
      if (!item.nombre_repuesto?.trim()) return res.status(400).json({ error: 'Cada ítem debe tener nombre de repuesto.' })
      if (!item.urgencia) return res.status(400).json({ error: 'Cada ítem debe tener urgencia.' })
      if (!item.grupo) return res.status(400).json({ error: 'Cada ítem debe tener grupo.' })
    }
    const itemsConHistorial = items.map(item => ({
      ...item,
      historial: [{ estado: 'Para analisis', usuario: item.solicita || 'Sistema', nota: 'Pedido creado' }],
    }))
    const nuevo = await new SanPabloPedido({ fecha, items: itemsConHistorial }).save()
    res.status(201).json(nuevo)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const actualizarItem = async (req, res) => {
  try {
    const { usuario, nota, ...campos } = req.body
    const setFields = {}
    Object.entries(campos).forEach(([k, v]) => { setFields[`items.$.${k}`] = v })
    const update = { $set: setFields }
    if (campos.estado) {
      update.$push = { 'items.$.historial': { estado: campos.estado, usuario: usuario || 'Sistema', fecha: new Date(), ...(nota ? { nota } : {}) } }
    }
    const updated = await SanPabloPedido.findOneAndUpdate(
      { _id: req.params.id, 'items._id': req.params.itemId },
      update,
      { new: true }
    )
    if (!updated) return res.status(404).json({ error: 'Pedido o ítem no encontrado.' })
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export const borrarItem = async (req, res) => {
  try {
    const pedido = await SanPabloPedido.findById(req.params.id)
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' })
    pedido.items.pull(req.params.itemId)
    if (pedido.items.length === 0) {
      await SanPabloPedido.findByIdAndDelete(req.params.id)
    } else {
      await pedido.save()
    }
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
