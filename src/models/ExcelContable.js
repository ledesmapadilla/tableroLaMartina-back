import mongoose from "mongoose";
import { archivoAdjuntoSchema } from "./archivoAdjunto.js";

/**
 * El Excel mensual de Contable tal como se guardó el 05/11/2026, en Cloudinary.
 * Duró unas horas: desde ese mismo día el Excel no se guarda, se lee y quedan
 * sus filas (FilaContable). Queda para el de octubre de 2026, que la pantalla
 * pasa a la tabla y borra. Cuando no quede ninguno, esto se puede sacar.
 */
const excelContableSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    archivo: { type: archivoAdjuntoSchema, required: true },
  },
  { timestamps: true }
);

excelContableSchema.index({ anio: 1, mes: 1 }, { unique: true });

export default mongoose.model("ExcelContable", excelContableSchema, "excelescontables");
