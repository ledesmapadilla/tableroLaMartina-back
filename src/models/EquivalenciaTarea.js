import mongoose from "mongoose";

/**
 * Qué tareas de Citrusvil equivalen a cada tarea de La Martina (05/11/2026).
 *
 * Las de Citrusvil son los textos de "Detalle de tarea" del Excel mensual de
 * Contable (FilaContable.tarea); las de La Martina, las de Altas › Tareas. Una
 * tarea de La Martina junta varias de Citrusvil, y desde el 06/11/2026 una de
 * Citrusvil puede estar en varias de La Martina (siempre en la misma unidad).
 */
const equivalenciaTareaSchema = new mongoose.Schema(
  {
    tarea: { type: mongoose.Schema.Types.ObjectId, ref: "Tarea", required: true },
    citrusvil: [{ type: String, trim: true }],
    observaciones: { type: String, trim: true },
  },
  { timestamps: true }
);

equivalenciaTareaSchema.index({ tarea: 1 }, { unique: true });
equivalenciaTareaSchema.index({ citrusvil: 1 });

export default mongoose.model("EquivalenciaTarea", equivalenciaTareaSchema, "equivalenciastareas");
