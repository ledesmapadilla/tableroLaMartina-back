import { Schema, model } from "mongoose";
import { campoEstablecimiento } from "./Establecimiento.js";

// Lo único que se puede corregir desde el informe: el precio con el que se
// certifica el renglón y la cantidad total de la tarea. El resto del parte se
// corrige en la planilla.
export const CAMPOS = ["cantidad", "precioUnitario"];

/**
 * Una corrección hecha sobre un renglón del informe de tareas por personal.
 *
 * Es un registro por cambio, no una fila que se pisa: el valor que rige es el
 * del último cambio de ese campo, y los anteriores quedan como historial, que
 * es lo que se mira desde la planilla.
 *
 * El renglón es una persona, una tarea y un período: no se apoya en un parte,
 * porque la cantidad del informe es la suma de varios.
 */
const CambioCertificacionSchema = new Schema(
  {
    establecimiento: campoEstablecimiento,
    persona: { type: Schema.Types.ObjectId, ref: "Personal", required: true },
    tarea: { type: Schema.Types.ObjectId, ref: "Tarea", required: true },
    // El renglón del informe es por cliente: la misma persona puede hacer la
    // misma tarea para dos clientes, a precios distintos, y cada uno se
    // corrige por separado.
    cliente: { type: String, trim: true, default: "" },
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },

    campo: { type: String, required: true, enum: CAMPOS },
    // Con qué valor venía el renglón antes del cambio. Queda para poder leer
    // el historial sin rehacer la cuenta.
    anterior: { type: Number, default: null },
    nuevo: { type: Number, required: true },

    // Por qué se cambió. Obligatorio: un ajuste sin motivo no se puede
    // justificar después.
    detalle: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// El historial se lee siempre por renglón, del cambio más nuevo al más viejo.
CambioCertificacionSchema.index({
  establecimiento: 1,
  anio: 1,
  mes: 1,
  persona: 1,
  tarea: 1,
  createdAt: -1,
});

export default model("CambioCertificacion", CambioCertificacionSchema);
