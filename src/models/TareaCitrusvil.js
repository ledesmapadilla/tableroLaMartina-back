import mongoose from "mongoose";

/**
 * Las tareas de Citrusvil que se agregan a mano (05/11/2026), desde el botón
 * "Tareas Citrusvil" de Equivalencias de tareas.
 *
 * Las demás salen solas de "Detalle de tarea" de las tablas mensuales de
 * Contable (FilaContable.tarea). El listado para las equivalencias es la suma
 * de las dos.
 */
const tareaCitrusvilSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    unidad: { type: String, trim: true },
    creadaPor: { type: String, trim: true },
  },
  { timestamps: true }
);

tareaCitrusvilSchema.index({ nombre: 1 }, { unique: true });

export default mongoose.model("TareaCitrusvil", tareaCitrusvilSchema, "tareascitrusvil");
