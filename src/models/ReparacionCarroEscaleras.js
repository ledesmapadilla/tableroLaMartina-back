import { Schema, model } from "mongoose";

// La reparación de un carro porta escaleras en una cosecha (28/10/2026), en
// Escaleras › Reparación › Carros porta escaleras: la fecha, los trabajos a
// realizar y observaciones. Una por carro y cosecha; los carros salen del
// padrón de CC (equipo "Carro porta escaleras"). La fecha límite es una sola
// para todos los carros (FechaLimiteEscaleras).
const ReparacionCarroEscalerasSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    cc: { type: Schema.Types.ObjectId, ref: "CentroCosto", required: true },
    fecha: { type: Date, required: true },
    trabajos: { type: String, trim: true, required: true },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

ReparacionCarroEscalerasSchema.index({ cosecha: 1, cc: 1 }, { unique: true });

export default model("ReparacionCarroEscaleras", ReparacionCarroEscalerasSchema);
