import mongoose from "mongoose";

/**
 * El monto mensual de un alquiler (12/11/2026), como el precio del gasoil:
 * uno por fecha y alquiler; cargar otro en la misma fecha lo pisa. Rige el de
 * la fecha más nueva. La fecha va a las 00:00 UTC del día.
 */
const precioAlquilerSchema = new mongoose.Schema(
  {
    alquiler: { type: mongoose.Schema.Types.ObjectId, ref: "Alquiler", required: true },
    fecha: { type: Date, required: true },
    precio: { type: Number, required: true, min: 0 },
    cargadoPor: { type: String, trim: true },
  },
  { timestamps: true }
);

precioAlquilerSchema.index({ alquiler: 1, fecha: -1 }, { unique: true });

export default mongoose.model("PrecioAlquiler", precioAlquilerSchema, "preciosalquiler");
