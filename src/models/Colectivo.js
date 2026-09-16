import { Schema, model } from "mongoose";

const ColectivoSchema = new Schema(
  {
    // El CC del colectivo es su patente, igual que en el padrón de CC y en
    // Compras. Hasta el 15/09/2026 había además un número interno (250–283)
    // en este campo y la patente aparte; el número se borró
    // (scripts/colectivosPatenteComoCC.js).
    cc: { type: String, required: true, trim: true, uppercase: true },
    descripcion: { type: String, trim: true },
    supervisor: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model("Colectivo", ColectivoSchema);
