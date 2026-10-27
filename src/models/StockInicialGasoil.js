import { Schema, model } from "mongoose";
import { CAMPOS_GASOIL, campoTipo } from "./GasoilDia.js";

// Compras › Gasoil › Auditorías (21/10/2026): el stock con el que arranca el
// tanque de cada campo, para tener de dónde partir. Uno solo por campo: los
// litros, la fecha de la medición y la foto del nivel.

// La foto, como en AuditoriaGasoil (Cloudinary, desde el front).
const FotoSchema = new Schema(
  {
    url: { type: String, required: true },
    nombre: { type: String, default: "" },
    publicId: { type: String, default: "" },
    tipo: { type: String, default: "image" },
  },
  { _id: false }
);

const StockInicialGasoilSchema = new Schema(
  {
    campo: { type: String, enum: CAMPOS_GASOIL, required: [true, "Falta el campo"] },
    // El tanque (27/10/2026): uno por campo y tipo.
    tipo: campoTipo,
    fecha: { type: Date, required: [true, "Falta la fecha"] },
    litros: { type: Number, required: [true, "Faltan los litros"], min: [0, "Los litros no pueden ser negativos"] },
    foto: { type: FotoSchema, default: null },
    cargadoPor: { type: String, trim: true, default: "" },
    // El punto de partida (27/10/2026): el momento en que se cargaron (o se
    // corrigieron) los litros. Lo de antes no cuenta; los consumos, los
    // ingresos y las auditorías escritos después, sí. Cambiar la foto no lo
    // mueve.
    momento: { type: Date, default: null },
  },
  { timestamps: true }
);

StockInicialGasoilSchema.index({ campo: 1, tipo: 1 }, { unique: true });

export default model("StockInicialGasoil", StockInicialGasoilSchema);
