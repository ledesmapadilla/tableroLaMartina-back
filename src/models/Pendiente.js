import { Schema, model } from "mongoose";

/**
 * Pendientes de la reunión: lo que queda por hacer, con quién lo tiene a cargo.
 *
 * El sector y el responsable se guardan como texto y no como enum: los listados
 * viven arriba de `src/components/pages/Pendientes.jsx`, así sumar un sector o
 * una persona es tocar el front y nada más. El responsable "Otro" deja escribir
 * el nombre a mano, así que tampoco sería un conjunto cerrado.
 */
const PendienteSchema = new Schema(
  {
    // Formato YYYY-MM-DD, como en Visita: guardarla como texto evita que la
    // zona horaria corra la fecha un día al ir y volver del cluster.
    fecha:         { type: String, required: true, trim: true },
    sector:        { type: String, required: true, trim: true },
    responsable:   { type: String, trim: true, default: "" },
    // Pendiente / En curso / Terminada. Lo que se cargó antes de que el estado
    // existiera no lo trae: en pantalla se lee como "Pendiente".
    estado:        { type: String, trim: true, default: "Pendiente" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

PendienteSchema.index({ fecha: -1 });

export default model("Pendiente", PendienteSchema);
