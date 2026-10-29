import { Schema, model } from "mongoose";

// Un horómetro puede romperse y reemplazarse: el equipo nuevo arranca de cero y
// la lectura "retrocede" sin que haya error de carga. Cada fila es uno de esos
// reemplazos y guarda cuántas horas alcanzó a marcar el anterior, que es el
// dato con el que se siguen contando las horas de la máquina.
//
// numero identifica al horómetro que EMPIEZA con este cambio: la máquina nace
// con el 1, el primer reemplazo crea el 2, el siguiente el 3.
const CambioHorometroSchema = new Schema(
  {
    tractor: { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    fecha: { type: Date, required: true },
    numero: { type: Number, required: true, min: 2 },
    // Horas que llegó a marcar el horómetro anterior antes de salir de servicio.
    horasAnterior: { type: Number, required: true, min: 0 },
    // Suma de las horas de todos los horómetros previos a este. Es lo que hay
    // que sumarle a la lectura para tener las horas reales de la máquina.
    base: { type: Number, required: true, min: 0 },
    // Con cuánto arranca el horómetro nuevo. Casi siempre 0.
    lecturaInicial: { type: Number, default: 0 },
    observaciones: { type: String, trim: true, default: "" },
    // Un cambio que no existió (29/10/2026: el 191 y el 102, registrados
    // desde el cartel de "el horómetro retrocede" sin que se cambiara nada).
    // No cuenta, pero queda guardado por si hay que volver atrás.
    anulado: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CambioHorometroSchema.index({ tractor: 1, fecha: -1 });

export default model("CambioHorometro", CambioHorometroSchema);
