import mongoose from "mongoose";

/**
 * El precio del gasoil (07/11/2026), cargado arriba de la tabla de
 * Contable › Equivalencias tareas/variables. Uno por fecha: cargar otro en la
 * misma fecha lo pisa. Rige el de la fecha más nueva; los anteriores quedan
 * como historial.
 *
 * La fecha se guarda a las 00:00 UTC del día, así no se corre con la zona
 * horaria.
 */
const precioGasoilSchema = new mongoose.Schema(
  {
    fecha: { type: Date, required: true },
    precio: { type: Number, required: true, min: 0 },
    cargadoPor: { type: String, trim: true },
  },
  { timestamps: true }
);

precioGasoilSchema.index({ fecha: -1 }, { unique: true });

export default mongoose.model("PrecioGasoil", precioGasoilSchema, "preciosgasoil");
