import { Schema, model } from "mongoose";

// Cuánto pesa cada sistema en la reparación de una Manitou (21/10/2026), en
// %: se cargan a mano en Manitous › General (la plantilla) y valen para las
// cinco. Suman 100. Uno por cosecha. Con eso cada Manitou muestra su avance:
// el peso de cada sistema por la parte de sus tareas con OK.
const PesosManitouSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    // { [sistema]: % }, con los ids de SISTEMAS de chequeossanpablo.controller.js.
    pesos: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

PesosManitouSchema.index({ cosecha: 1 }, { unique: true });

export default model("PesosManitou", PesosManitouSchema);
