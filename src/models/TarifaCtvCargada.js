import mongoose from "mongoose";

/**
 * Las tarifas de Citrusvil cargadas a mano (13/11/2026): el precio unitario de
 * cada tarea de Ctv por mes, de los meses que no tienen Excel mensual en el
 * programa. Las de enero a septiembre de 2026 salen del Excel "tarifas ctv
 * 2026.xlsx" (hoja AMN) que armó el usuario; desde octubre la Evolución de
 * tarifas las saca del Excel mensual, como siempre.
 *
 * La pantalla (ContableTarifasCtv.jsx) usa estas para los meses que las
 * tienen y el Excel mensual para el resto. No son de un campo: la tarifa de
 * Ctv es la misma en Berdina y en San Pablo.
 */
const tarifaCtvCargadaSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    tarea: { type: String, required: true, trim: true },
    // claveTarea(tarea): así se cruza con las tareas del Excel mensual.
    clave: { type: String, required: true },
    precio: { type: Number, required: true, min: 0 },
    origen: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

tarifaCtvCargadaSchema.index({ anio: 1, mes: 1, clave: 1 }, { unique: true });

export default mongoose.model("TarifaCtvCargada", tarifaCtvCargadaSchema, "tarifasctvcargadas");
