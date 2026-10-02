import { Schema, model } from "mongoose";

// Un frente de trabajo de San Pablo, con su cliente (02/10/2026). Se da de
// alta desde Carros porta escaleras y se elige en los ingresos de los carros y
// en los movimientos de Escaleras.
const FrenteSanPabloSchema = new Schema(
  {
    nombre: { type: String, trim: true, required: true },
    cliente: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

// El nombre no se repite (sin distinguir mayúsculas).
FrenteSanPabloSchema.index({ nombre: 1 }, { unique: true, collation: { locale: "es", strength: 2 } });

export default model("FrenteSanPablo", FrenteSanPabloSchema);
