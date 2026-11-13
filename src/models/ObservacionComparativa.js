import mongoose from "mongoose";

/**
 * Las observaciones de una fila de la solapa Comparativa (12/11/2026): de un
 * mes, un campo y una comparativa (volumétrica o costos). Cualquiera con
 * sesión escribe; cada nota guarda quién y cuándo, y la borra solo quien la
 * escribió (o Nacho).
 *
 * `clave` es la de la fila en la comparativa ("lm:<grupo>" o "ctv:<tarea>",
 * compararGrupos en ContableComparativa.jsx); `tarea`, su nombre al escribir,
 * para reconocerla si la clave cambia.
 */
const notaSchema = new mongoose.Schema(
  {
    texto: { type: String, required: true, trim: true, maxlength: 1000 },
    usuario: { type: String, trim: true },
    nombre: { type: String, trim: true },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

const observacionComparativaSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    campo: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, enum: ["cantidad", "costos"] },
    clave: { type: String, required: true, trim: true },
    tarea: { type: String, trim: true },
    notas: [notaSchema],
  },
  { timestamps: true }
);

observacionComparativaSchema.index({ anio: 1, mes: 1, campo: 1, tipo: 1, clave: 1 }, { unique: true });

export default mongoose.model("ObservacionComparativa", observacionComparativaSchema, "observacionescomparativa");
