import mongoose from "mongoose";

/**
 * De dónde salió la tabla de Contable de un mes (05/11/2026): el nombre del
 * Excel, quién la armó y cuándo. Uno por mes; las filas están en FilaContable.
 *
 * El Excel no se guarda: se lee en el navegador y solo quedan las filas, así
 * no ocupa lugar en Cloudinary.
 */
const tablaContableSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    origen: { type: String, trim: true },
    cargadaPor: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

tablaContableSchema.index({ anio: 1, mes: 1 }, { unique: true });

export default mongoose.model("TablaContable", tablaContableSchema, "tablascontables");
