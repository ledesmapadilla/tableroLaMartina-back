import mongoose from "mongoose";

/**
 * La equivalencia de una tarea de Citrusvil solo para la Comparativa de
 * costos (07/11/2026). Si una tarea de Citrusvil no tiene, en costos va con
 * la de siempre (EquivalenciaTarea); si tiene, en costos va con estas tareas
 * de La Martina y no con aquellas.
 *
 * Ej.: «Motobomba 96HP x HRA» en cantidad va con Horas Motor Generador, pero
 * lo que se le paga a la gente por eso es MotoGenerador-Personal.
 *
 * `nombre` es el de la tarea de Citrusvil, con el nombre que manda para su
 * clave (nombresCitrusvil en equivalencias.controller.js).
 */
const equivalenciaCostosSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    tareas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tarea" }],
    // Y/o alquileres (12/11/2026): en costos se suman a las tareas, con su
    // monto del mes. `alquiler` (uno solo) es como se guardó el primer día;
    // se lee junto con la lista.
    alquileres: [{ type: mongoose.Schema.Types.ObjectId, ref: "Alquiler" }],
    alquiler: { type: mongoose.Schema.Types.ObjectId, ref: "Alquiler", default: null },
  },
  { timestamps: true }
);

equivalenciaCostosSchema.index({ nombre: 1 }, { unique: true });
equivalenciaCostosSchema.index({ alquileres: 1 });

export default mongoose.model("EquivalenciaCostos", equivalenciaCostosSchema, "equivalenciascostos");
