import { Schema, model } from "mongoose";

// Un repuesto de una fila: guardado, o pedido y con qué pedido de
// Compras (San Pablo) salió. El estado se sigue en Compras.
const RepuestoSchema = new Schema(
  {
    // Vacío mientras está solo guardado; con el pedido, ya salió a Compras.
    pedido: { type: Schema.Types.ObjectId, ref: "SanPabloPedido", default: null },
    nro_pedido: { type: Number },
    nombre_repuesto: { type: String, trim: true, required: true },
    cant: { type: Number, min: 1, required: true },
    unidad: { type: String, trim: true, required: true },
    cc: { type: String, trim: true, required: true },
    urgencia: { type: String, required: true },
    descripcion: { type: String, trim: true },
    solicita: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Un problema de una fila (08/10/2026): una fila puede tener varios, y cada
// uno se marca resuelto con su círculo.
const ProblemaSchema = new Schema(
  {
    texto: { type: String, trim: true, required: true },
    resuelto: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Una fila de la tabla de un sistema (Motor, Torre…) de Manitous › General en
// una cosecha (06/10/2026): el ítem, si se chequeó, cómo dio la tarea (ok o
// x, con el problema escrito) y los repuestos pedidos.
const ChequeoSanPabloSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    seccion: { type: String, trim: true, required: true },
    sistema: { type: String, trim: true, required: true },
    item: { type: String, trim: true, required: true },
    chequeado: { type: Boolean, default: false },
    tarea: { type: String, enum: ["ok", "x", null], default: null },
    // El problema de antes, uno solo con la x (tarea). Las filas viejas se
    // pasan a `problemas` la primera vez que se tocan.
    problema: { type: String, trim: true, default: "" },
    problemas: { type: [ProblemaSchema], default: [] },
    repuestos: { type: [RepuestoSchema], default: [] },
  },
  { timestamps: true }
);

ChequeoSanPabloSchema.index({ cosecha: 1, seccion: 1, sistema: 1, createdAt: 1 });

export default model("ChequeoSanPablo", ChequeoSanPabloSchema);
