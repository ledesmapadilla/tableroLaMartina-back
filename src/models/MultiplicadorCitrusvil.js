import mongoose from "mongoose";

/**
 * Las tareas de Citrusvil que hay que multiplicar (12/11/2026). Ej. las de
 * doble pasada ("Desmalezado 8 x 5 Doble Pasada x PLA"): el Excel trae las
 * plantas una vez y son el doble, en cantidad y en plata. En las comparativas
 * de Contable la cantidad y el subtotal de esas filas del Excel van por
 * `factor`; la tabla del mes queda como vino.
 *
 * `nombre` es el de la tarea de Citrusvil con el nombre que manda para su
 * clave (nombresCitrusvil). Sin documento, el factor es 1.
 */
const multiplicadorCitrusvilSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    factor: { type: Number, required: true, min: 0 },
    cargadoPor: { type: String, trim: true },
  },
  { timestamps: true }
);

multiplicadorCitrusvilSchema.index({ nombre: 1 }, { unique: true });

export default mongoose.model("MultiplicadorCitrusvil", multiplicadorCitrusvilSchema, "multiplicadorescitrusvil");
