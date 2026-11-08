import { Schema, model } from "mongoose";
import { campoEstablecimiento } from "./Establecimiento.js";

// Un día de un jornalizado (02/11/2026): la persona, su horario en dos tramos,
// igual que la planilla de partes, y lo que hizo escrito a mano. Se carga
// desde el botón Jornalizados de la planilla de carga de datos. No va a la
// certificación: es una tabla aparte, por campo.
const JornalizadoSchema = new Schema(
  {
    establecimiento: campoEstablecimiento,
    fecha: { type: Date, required: true },
    persona: { type: Schema.Types.ObjectId, ref: "Personal", required: true },

    // Como en ParteDiario: "HH:mm", la hora del reloj.
    horaIngreso: { type: String, trim: true, default: "" },
    horaEgreso: { type: String, trim: true, default: "" },
    horaIngreso2: { type: String, trim: true, default: "" },
    horaEgreso2: { type: String, trim: true, default: "" },
    // La suma de los dos tramos. La calcula el backend.
    totalHoras: { type: Number, default: 0 },

    // La tarea realizada, en texto libre y largo.
    tarea: { type: String, trim: true, default: "" },

    // El ayudamemoria, como en los partes: se guarda con fecha y personal y se
    // completa después. Mientras tanto a esa persona no se le carga otro día.
    provisorio: { type: Boolean, default: false },

    // Colchón de horas (08/11/2026), solo en Berdina: el mismo círculo
    // "Colch. Hs." de la planilla de partes: cuenta las horas del total del día (totalHoras).
    // Prendido, la tarea realizada es obligatoria también en un provisorio.
    colchonHs: { type: Boolean, default: false },
  },
  { timestamps: true }
);

JornalizadoSchema.index({ establecimiento: 1, fecha: 1 });

export default model("Jornalizado", JornalizadoSchema);
