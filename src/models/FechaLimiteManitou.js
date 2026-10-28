import { Schema, model } from "mongoose";

// Para cuándo tienen que estar reparadas las Manitou (28/10/2026), una por
// cosecha: la total, cargada arriba de las tarjetas de Manitous, y la de cada
// Manitou, en su panel de avance, que no puede pasar la total. null mientras
// no se cargó.
const FechaLimiteManitouSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    fecha: { type: Date, default: null },
    // { [seccion]: fecha }, con las secciones de catalogos/manitous.js.
    porManitou: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

FechaLimiteManitouSchema.index({ cosecha: 1 }, { unique: true });

export default model("FechaLimiteManitou", FechaLimiteManitouSchema);
