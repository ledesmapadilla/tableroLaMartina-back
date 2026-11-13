import mongoose from "mongoose";

/**
 * Los alquileres de Contable (12/11/2026), cargados en Equivalencias
 * tareas/variables junto al gasoil y el dólar. El nombre lo pone el usuario;
 * el monto es fijo por mes, con fecha e historial (PrecioAlquiler).
 *
 * Una tarea de Citrusvil puede ir con un alquiler en la Comparativa de costos
 * (EquivalenciaCostos.alquiler): ahí la fila lleva el nombre del alquiler, con
 * cantidad 1 y el monto vigente del lado de La Martina.
 */
const alquilerSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    creadoPor: { type: String, trim: true },
  },
  { timestamps: true }
);

alquilerSchema.index({ nombre: 1 }, { unique: true });

export default mongoose.model("Alquiler", alquilerSchema, "alquileres");
