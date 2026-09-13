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
    // En qué cuenta el equipo. Casi toda la flota cuenta horas (service cada
    // 250 hs); los camiones, como el CC 901, cuentan kilómetros (cada 10.000).
    unidad: { type: String, enum: ["hs", "km"], default: "hs" },
  },
  { timestamps: true }
);

export default model("Tractor", TractorSchema);
