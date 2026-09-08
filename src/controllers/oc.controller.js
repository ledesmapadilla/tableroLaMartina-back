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

export const crear = async (req, res) => {
  try {
    const { items, total, establecimiento } = req.body
    if (!items || items.length === 0) return res.status(400).json({ error: 'La OC debe tener al menos un ítem.' })

    const prefijo = establecimiento === 'berdina' ? 'B' : establecimiento === 'sanpablo' ? 'SP' : 'MX'
    const last = await OC.findOne({ establecimiento }).sort({ nro_oc: -1 })
    const nro_oc = last?.nro_oc ? last.nro_oc + 1 : 1
    const nro_oc_display = `OC-${prefijo}-${String(nro_oc).padStart(3, '0')}`

    const oc = await new OC({ nro_oc, establecimiento, nro_oc_display, items, total }).save()

    await Promise.all(items.map(ocItem => {
      const Model = ocItem._src === 'berdina' ? BerdinaPedido : SanPabloPedido
      return Model.findOneAndUpdate(
        { _id: ocItem.pedidoId, 'items._id': ocItem.itemId },
        {
          $set: { 'items.$.estado': 'Para retirar', 'items.$.oc': nro_oc_display },
          $push: { 'items.$.historial': { estado: 'Para retirar', usuario: 'Comprador', nota: `OC generada: ${nro_oc_display}`, fecha: new Date() } },
        }
      )
    }))

    res.status(201).json(oc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
