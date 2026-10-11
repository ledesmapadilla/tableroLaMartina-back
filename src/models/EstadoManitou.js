import { Schema, model } from "mongoose";

// En qué está una Manitou en una cosecha (11/10/2026): en reparación o en
// espera, o sin marcar (null). Uno por cosecha + Manitou; General (la
// plantilla) no tiene.
export const ESTADOS_MANITOU = ["reparacion", "espera"];

const EstadoManitouSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    seccion: { type: String, trim: true, required: true },
    estado: { type: String, enum: [...ESTADOS_MANITOU, null], default: null },
  },
  { timestamps: true }
);

EstadoManitouSchema.index({ cosecha: 1, seccion: 1 }, { unique: true });

export default model("EstadoManitou", EstadoManitouSchema);
