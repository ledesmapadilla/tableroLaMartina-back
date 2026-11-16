import mongoose from "mongoose";

/**
 * Contable › Caja (13/11/2026, segunda versión): cada ingreso o gasto de la
 * caja es un movimiento suelto, en una sola tabla con filtros (el modelo es
 * la página de Gasoil del Sistema de Gestión Lepa). Reemplaza a la caja por
 * semanas con ingreso fijo y sobrante, que el usuario hizo sacar.
 */

// El adjunto, como lo guarda services/archivos.js del front (Cloudinary).
const ArchivoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    nombre: { type: String, default: "" },
    publicId: { type: String, default: "" },
    tipo: { type: String, default: "image" },
  },
  { _id: false }
);

export const CONCEPTOS_CAJA = ["ingreso", "gasto"];

const cajaMovimientoSchema = new mongoose.Schema(
  {
    fecha: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"] },
    concepto: { type: String, required: true, enum: { values: CONCEPTOS_CAJA, message: "El concepto es ingreso o gasto" } },
    monto: { type: Number, required: true, min: [0.01, "El monto tiene que ser mayor que cero"] },
    descripcion: { type: String, trim: true, default: "", maxlength: 300 },
    observaciones: { type: String, trim: true, default: "", maxlength: 1000 },
    archivos: { type: [ArchivoSchema], default: [] },
    cargadoPor: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

cajaMovimientoSchema.index({ fecha: -1 });

export default mongoose.model("CajaMovimiento", cajaMovimientoSchema, "cajamovimientos");
