import mongoose from 'mongoose'

const GRUPOS = ['Pulverizadora', 'Chancho', 'Nodriza', 'Desmalezadora', 'Herbicida', 'Abonadora', 'Riego', 'Arquito', 'Tractores', 'Camioneta', 'Manitou', 'Colectivos', 'Herreria', 'Gomeria', 'Stock', 'Otros']

const historialItemSchema = new mongoose.Schema({
  fecha:   { type: Date, default: Date.now },
  estado:  { type: String },
  usuario: { type: String },
  nota:    { type: String },
}, { _id: false })

const itemSchema = new mongoose.Schema({
  nombre_repuesto: { type: String, required: true, trim: true },
  cant:            { type: Number, min: 1 },
  unidad:          { type: String, trim: true },
  descripcion:     { type: String, trim: true },
  urgencia:        { type: String, enum: ['Baja', 'Media', 'Alta', 'Crítica'], required: true, default: 'Media' },
  grupo:           { type: String, enum: GRUPOS, required: true },
  cc:              { type: String, trim: true },
  solicita:        { type: String, trim: true },
  estado:          { type: String, enum: ['Para analisis', 'Para revision', 'En analisis', 'Pedido', 'Para hacer OC', 'Autorizar', 'Pendiente', 'En proceso', 'Para retirar', 'Retirado', 'Completado', 'Cancelado', 'Rechazado'], default: 'Para analisis' },
  historial:  { type: [historialItemSchema], default: [] },
  stock:      { type: Number },
  proveedor1: { type: String },
  precio1:    { type: Number },
  proveedor2: { type: String },
  precio2:    { type: Number },
  proveedor3: { type: String },
  precio3:    { type: Number },
  oc:         { type: String },
})

const pedidoSchema = new mongoose.Schema({
  nro_pedido: { type: Number, index: true },
  fecha:      { type: Date, required: true },
  items:      [itemSchema],
}, { timestamps: true })

pedidoSchema.index({ 'items.estado': 1 })

pedidoSchema.pre('save', async function () {
  if (this.isNew && !this.nro_pedido) {
    const last = await mongoose.model('SanPabloPedido').findOne({ nro_pedido: { $exists: true } }).sort({ nro_pedido: -1 })
    this.nro_pedido = last?.nro_pedido ? last.nro_pedido + 1 : 1
  }
})

export default mongoose.model('SanPabloPedido', pedidoSchema)
