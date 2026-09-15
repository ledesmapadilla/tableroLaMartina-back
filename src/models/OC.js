// Orden de pago (antes 'orden de compra'). El nombre del modelo y los campos
// nro_oc / nro_oc_display quedan como estaban para no mover la coleccion 'ocs'.

import mongoose from 'mongoose'

const ocItemSchema = new mongoose.Schema({
  pedidoId:        { type: String, required: true },
  itemId:          { type: String, required: true },
  nro_pedido:      { type: Number },
  _src:            { type: String },
  nombre_repuesto: { type: String },
  cant:            { type: Number },
  precio_unitario: { type: Number },
  precio_total:    { type: Number },
  proveedor:       { type: String },
  observaciones:   { type: String },
  fecha:           { type: Date },
}, { _id: false })

const ocSchema = new mongoose.Schema({
  nro_oc:          { type: Number },
  establecimiento: { type: String },
  nro_oc_display:  { type: String },
  fecha:           { type: Date, default: Date.now },
  items:           [ocItemSchema],
  total:           { type: Number },
}, { timestamps: true })

export default mongoose.model('OC', ocSchema)
