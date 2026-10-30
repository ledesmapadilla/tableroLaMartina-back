import { Schema, model } from "mongoose";

// Para cuándo tiene que estar terminada la reparación en Carros porta
// escaleras / Escaleras › Reparación (28/10/2026): una fecha por solapa y por
// cosecha, cargada arriba de cada tabla. null mientras no se cargó. Desde el
// 29/10/2026 "carros" es la de Reparación carros › General (porta escaleras), y
// "bines" y "bolsones" las de los carros porta bines y porta bolsones, y
// "tolvas" y "colectivos" las de Reparación tolvas y Colectivos › General, y
// "carrosTotal" la de los tres carros juntos (arriba de la página Carros).
export const SOLAPAS_FECHA_LIMITE = ["carros", "escaleras", "bines", "bolsones", "tolvas", "colectivos", "carrosTotal"];

const FechaLimiteEscalerasSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    carros: { type: Date, default: null },
    escaleras: { type: Date, default: null },
    bines: { type: Date, default: null },
    bolsones: { type: Date, default: null },
    tolvas: { type: Date, default: null },
    colectivos: { type: Date, default: null },
    carrosTotal: { type: Date, default: null },
  },
  { timestamps: true }
);

FechaLimiteEscalerasSchema.index({ cosecha: 1 }, { unique: true });

export default model("FechaLimiteEscaleras", FechaLimiteEscalerasSchema);
