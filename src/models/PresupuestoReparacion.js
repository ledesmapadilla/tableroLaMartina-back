import mongoose from "mongoose";
import { archivoAdjuntoSchema } from "./archivoAdjunto.js";

const historialSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    estado: { type: String },
    usuario: { type: String },
    nota: { type: String },
  },
  { _id: false }
);

/**
 * Un presupuesto de reparaciones (08/10/2026): un repuesto de una fila de
 * Manitous › General que el taller manda a cotizar con el botón Cotizar. Lo
 * ve el analista en Presupuestos reparaciones y hace solo el paso del
 * análisis: hasta tres proveedores con su precio, el elegido, observaciones y
 * el adjunto. No sigue a OP ni a Gerencia.
 *
 * Los datos del repuesto se copian al mandarlo: si después se corrige en la
 * fila, el presupuesto queda con lo que se pidió cotizar.
 */
const presupuestoSchema = new mongoose.Schema(
  {
    nro: { type: Number, index: true },
    fecha: { type: Date, default: Date.now },
    estado: { type: String, enum: ["Para cotizar", "Cotizado"], default: "Para cotizar" },

    // De dónde salió: la fila del chequeo y el repuesto dentro de ella. Un
    // repuesto se manda a cotizar una sola vez.
    chequeo: { type: mongoose.Schema.Types.ObjectId, ref: "ChequeoSanPablo", required: true },
    repuesto: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    cosecha: { type: Number },
    sistema: { type: String, trim: true },
    item: { type: String, trim: true },

    nombre_repuesto: { type: String, required: true, trim: true },
    cant: { type: Number, min: 1 },
    unidad: { type: String, trim: true },
    cc: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    grupo: { type: String, trim: true, default: "Manitou" },
    solicita: { type: String, trim: true },

    // El análisis, igual que en un ítem de pedido.
    stock: { type: Number },
    proveedor1: { type: String },
    precio1: { type: Number },
    proveedor2: { type: String },
    precio2: { type: Number },
    proveedor3: { type: String },
    precio3: { type: Number },
    // Cuál de los tres vale (1, 2 o 3). Vacío: el más barato.
    elegido: { type: Number, min: 1, max: 3 },
    observaciones: { type: String, trim: true },
    archivo: { type: archivoAdjuntoSchema, default: undefined },

    historial: { type: [historialSchema], default: [] },
  },
  { timestamps: true }
);

presupuestoSchema.pre("save", async function () {
  if (this.isNew && !this.nro) {
    const last = await mongoose
      .model("PresupuestoReparacion")
      .findOne({ nro: { $exists: true } })
      .sort({ nro: -1 });
    this.nro = last?.nro ? last.nro + 1 : 1;
  }
});

export default mongoose.model("PresupuestoReparacion", presupuestoSchema, "presupuestosreparaciones");
