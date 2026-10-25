import { Schema, model } from "mongoose";
import { CAMPOS_GASOIL } from "./GasoilDia.js";
import { conHistorial } from "../services/historial.js";

// Compras › Gasoil › Auditorías (20/10/2026): alguien de Compras pide una
// auditoría y el encargado de taller de cada campo anota cuántos litros tiene
// en el tanque y sube la foto del nivel. Al pedirla nacen las dos cargas,
// una por campo, vacías.

// La foto, como la guarda services/archivos.js del front (Cloudinary).
const FotoSchema = new Schema(
  {
    url: { type: String, required: true },
    nombre: { type: String, default: "" },
    publicId: { type: String, default: "" },
    tipo: { type: String, default: "image" },
  },
  { _id: false }
);

const CargaSchema = new Schema(
  {
    campo: { type: String, enum: CAMPOS_GASOIL, required: true },
    // null mientras el encargado no la cargó.
    litros: { type: Number, min: [0, "Los litros no pueden ser negativos"], default: null },
    foto: { type: FotoSchema, default: null },
    cargadoPor: { type: String, trim: true, default: "" },
    // La última vez que se cargó o corrigió.
    fechaCarga: { type: Date, default: null },
    // El corte de la cuenta (21/10/2026): la primera vez que se cargaron los
    // litros y la foto. Los consumos y los ingresos escritos hasta ahí entran
    // en esta auditoría; los de después, en la siguiente. Corregirla no lo
    // mueve. Las de antes no lo tienen: usan fechaCarga.
    corte: { type: Date, default: null },
  },
  { _id: false }
);

const AuditoriaGasoilSchema = new Schema(
  {
    fechaPedido: { type: Date, required: true },
    pedidoPor: { type: String, trim: true, default: "" },
    cargas: { type: [CargaSchema], default: [] },
  },
  { timestamps: true }
);

AuditoriaGasoilSchema.index({ fechaPedido: -1 });

// El antes y el después de cada cambio, en el registro (25/10/2026).
AuditoriaGasoilSchema.plugin(conHistorial, { nombre: "Auditoría de gasoil" });

export default model("AuditoriaGasoil", AuditoriaGasoilSchema);
