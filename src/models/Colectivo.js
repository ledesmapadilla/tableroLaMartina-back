import { Schema, model } from "mongoose";

const ColectivoSchema = new Schema(
  {
    cc: { type: String, required: true, trim: true },
    patente: { type: String, trim: true, uppercase: true },
    descripcion: { type: String, trim: true },
    supervisor: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model("Colectivo", ColectivoSchema);
