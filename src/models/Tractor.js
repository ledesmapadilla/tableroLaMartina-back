import { Schema, model } from "mongoose";

const TractorSchema = new Schema(
  {
    cc: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    supervisor: { type: String, trim: true },
    encargadoGral: { type: String, trim: true },
    // 1 a 5 los grupos de campo, 6 Berdina, 7 San Pablo y 8 "En desuso": la
    // maquina que salio de circulacion y se guarda con su historial.
    gruppo: { type: Number, default: 6, min: 1, max: 8 },
  },
  { timestamps: true }
);

export default model("Tractor", TractorSchema);
