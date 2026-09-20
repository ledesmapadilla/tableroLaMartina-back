import mongoose from 'mongoose'

const GRUPOS = ['Pulverizadora', 'Chancho', 'Nodriza', 'Desmalezadora', 'Herbicida', 'Abonadora', 'Riego', 'Arquito', 'Tractores', 'Camioneta', 'Manitou', 'Colectivos', 'Taller', 'Herreria', 'Gomeria', 'Stock', 'Otros']

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
  estado:          { type: String, enum: ['Para analisis', 'Para revision', 'En analisis', 'Pedido', 'Para hacer OP', 'Autorizar', 'Pendiente', 'En proceso', 'Para retirar', 'Retirado', 'Completado', 'Cancelado', 'Rechazado'], default: 'Para analisis' },
  historial:  { type: [historialItemSchema], default: [] },
  stock:      { type: Number },
  proveedor1: { type: String },
  precio1:    { type: Number },
  proveedor2: { type: String },
  precio2:    { type: Number },
  proveedor3: { type: String },
  precio3:    { type: Number },
  // Cuál de los tres presupuestos vale (1, 2 o 3). Vacío: el más barato.
  elegido:    { type: Number, min: 1, max: 3 },
  // Un apuro: quien lo reclamó y cuándo (20/09/2026). Lo pone cualquiera que
  // vea el pedido cuando el siguiente del circuito se está demorando, y el
  // back lo borra solo cuando el ítem cambia de estado.
  apuro: {
    type: new mongoose.Schema(
      {
        fecha: { type: Date, default: Date.now },
        por: { type: String, trim: true },
      },
      { _id: false }
    ),
    default: undefined,
  },
  oc:         { type: String },
  // El adjunto del ítem (19/09/2026): el presupuesto que sube el analista o lo
  // que suma el taller al pedir. El archivo vive en Cloudinary; acá queda la
  // URL con la que se abre, el nombre con el que se subió y el public_id con el
  // que se borra. `tipo` es "image" o "raw" (los PDF), que es lo que pide
  // Cloudinary para borrarlo.
  archivo: {
    type: new mongoose.Schema(
      {
        url: { type: String, required: true },
        nombre: { type: String, trim: true },
        publicId: { type: String, required: true },
        tipo: { type: String, enum: ["image", "raw"], default: "image" },
        subidoPor: { type: String, trim: true },
        fecha: { type: Date, default: Date.now },
      },
      { _id: false }
    ),
    default: undefined,
  },
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
