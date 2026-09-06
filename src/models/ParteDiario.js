import { Schema, model } from "mongoose";

// Un parte diario es una fila de la planilla mensual: una persona, un día, un
// turno y UNA tarea con su cantidad. En el Excel las tareas eran 21 columnas,
// pero nunca se usaba más de una por fila, así que acá van como un solo campo.
const ParteDiarioSchema = new Schema(
  {
    fecha: { type: Date, required: true },
    persona: { type: Schema.Types.ObjectId, ref: "Personal", required: true },
    cc: { type: Schema.Types.ObjectId, ref: "CentroCosto" },
    // A quién se le factura el trabajo. Va como texto libre, igual que el
    // lote: no hay padrón de clientes y los partes viejos no tienen ninguno.
    cliente: { type: String, trim: true, default: "" },

    // Los horarios se guardan como "HH:mm": son la hora del reloj, no un
    // instante, y el turno puede cruzar la medianoche (22:00 → 06:00).
    horaIngreso: { type: String, trim: true, default: "" },
    horaEgreso: { type: String, trim: true, default: "" },
    // Diferencia entre ingreso y egreso. Lo calcula el backend, es lo único
    // que no se carga a mano.
    totalHoras: { type: Number, default: 0 },

    // Horómetro de la máquina al entrar y salir del centro de costo. A
    // diferencia de las horas del turno, acá no hay vuelta de reloj: el
    // horómetro solo avanza.
    horomIngreso: { type: Number, default: null },
    horomSalida: { type: Number, default: null },
    // Diferencia entre los dos horómetros. La calcula el backend.
    horasCC: { type: Number, default: 0 },

    lote: { type: String, trim: true, default: "" },
    observacion: { type: String, trim: true, default: "" },

    tarea: { type: Schema.Types.ObjectId, ref: "Tarea" },
    // La cantidad se carga siempre a mano, también cuando la tarea se mide en
    // horas: puede no coincidir con el total del turno.
    cantidad: { type: Number, default: null },

    combustible: { type: Number, default: null },
    // Algunos meses se usa y otros no.
    turbo: { type: String, trim: true, default: "" },
    // Combustible cargado al turbo, aparte del de la máquina.
    combTurbo: { type: Number, default: null },
  },
  { timestamps: true }
);

ParteDiarioSchema.index({ fecha: 1, persona: 1 });

export default model("ParteDiario", ParteDiarioSchema);
