import { Schema, model } from "mongoose";

// Para cuándo tiene que estar terminada la reparación en Carros porta
// escaleras / Escaleras › Reparación (28/10/2026): una fecha por solapa y por
// cosecha, cargada arriba de cada tabla. null mientras no se cargó.
export const SOLAPAS_FECHA_LIMITE = ["carros", "escaleras"];

const FechaLimiteEscalerasSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    carros: { type: Date, default: null },
    escaleras: { type: Date, default: null },
  },
  { timestamps: true }
);

FechaLimiteEscalerasSchema.index({ cosecha: 1 }, { unique: true });

export default model("FechaLimiteEscaleras", FechaLimiteEscalerasSchema);
