import { Schema, model } from "mongoose";
import { CAMPOS_GASOIL } from "./GasoilDia.js";
import { conHistorial } from "../services/historial.js";

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
    fecha: { type: Date, required: [true, "Falta la fecha"] },
    litros: { type: Number, required: [true, "Faltan los litros"], min: [0, "Los litros no pueden ser negativos"] },
    foto: { type: FotoSchema, default: null },
    cargadoPor: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

StockInicialGasoilSchema.index({ campo: 1 }, { unique: true });

// El antes y el después de cada cambio, en el registro (25/10/2026).
StockInicialGasoilSchema.plugin(conHistorial, { nombre: "Stock inicial de gasoil" });

export default model("StockInicialGasoil", StockInicialGasoilSchema);
