import mongoose from "mongoose";

/**
 * Contable › Caja (13/11/2026): el control de caja por semana, de viernes a
 * jueves (el viernes siguiente ya es otra semana). Cada semana tiene un
 * ingreso fijo (500.000 de entrada, se puede cambiar), entradas eventuales y
 * los gastos, con fotos o archivos. Lo que sobra pasa a la semana que viene
 * (catalogos/caja.js arma la cuenta).
 *
 * `semana` es la fecha del viernes que la abre ("2026-11-13"). Un documento
 * nace con la primera cosa que se carga en esa semana.
 */

// El adjunto, como lo guarda services/archivos.js del front (Cloudinary).
const ArchivoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    nombre: { type: String, default: "" },
    publicId: { type: String, default: "" },
    tipo: { type: String, default: "image" },
  },
  { _id: false }
);

const monto = { type: Number, required: true, min: [0.01, "El monto tiene que ser mayor que cero"] };
const fecha = { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ };

const EntradaSchema = new mongoose.Schema(
  {
    fecha,
    monto,
    descripcion: { type: String, trim: true, default: "", maxlength: 300 },
    cargadoPor: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const GastoSchema = new mongoose.Schema(
  {
    fecha,
    monto,
    descripcion: { type: String, trim: true, default: "", maxlength: 300 },
    archivos: { type: [ArchivoSchema], default: [] },
    cargadoPor: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const cajaSemanaSchema = new mongoose.Schema(
  {
    semana: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // El ingreso fijo de esta semana. null: el mismo que la semana anterior
    // (o 500.000 si no hay ninguna). Cambiarlo vale desde esta semana en
    // adelante, hasta la próxima que tenga el suyo.
    fijo: { type: Number, default: null, min: [0, "El ingreso fijo no puede ser negativo"] },
    entradas: { type: [EntradaSchema], default: [] },
    gastos: { type: [GastoSchema], default: [] },
  },
  { timestamps: true }
);

cajaSemanaSchema.index({ semana: 1 }, { unique: true });

export default mongoose.model("CajaSemana", cajaSemanaSchema, "cajasemanas");
