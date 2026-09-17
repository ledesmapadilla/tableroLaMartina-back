import { Schema, model } from "mongoose";
import { campoEstablecimiento } from "./Establecimiento.js";

// Un parte diario es una fila de la planilla mensual: una persona, un día, un
// turno y UNA tarea con su cantidad. En el Excel las tareas eran 21 columnas,
// pero nunca se usaba más de una por fila, así que acá van como un solo campo.
const ParteDiarioSchema = new Schema(
  {
    // En qué campo se trabajó. El personal, las tareas y los CC son de La
    // Martina y se comparten; lo que separa a los dos campos es el parte.
    establecimiento: campoEstablecimiento,
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
    // El segundo tramo del día: en San Pablo se corta al mediodía y se retoma
    // a la tarde (17/09/2026). En Caspinchango van vacíos.
    horaIngreso2: { type: String, trim: true, default: "" },
    horaEgreso2: { type: String, trim: true, default: "" },
    // La suma de los dos tramos. Lo calcula el backend, es lo único que no se
    // carga a mano.
    totalHoras: { type: Number, default: 0 },

    // Horómetro de la máquina al entrar y salir del centro de costo. A
    // diferencia de las horas del turno, acá no hay vuelta de reloj: el
    // horómetro solo avanza.
    horomIngreso: { type: Number, default: null },
    horomSalida: { type: Number, default: null },
    // Diferencia entre los dos horómetros. La calcula el backend.
    horasCC: { type: Number, default: 0 },

    lote: { type: String, trim: true, default: "" },
    // Si el trabajo quedó terminado o sigue en proceso. Se alterna desde la
    // tabla con el círculo verde / rojo (17/09/2026).
    terminado: { type: Boolean, default: false },
    observacion: { type: String, trim: true, default: "" },

    // Un parte con fecha posterior al cierre de un mes va al certificado
    // siguiente, salvo que se lo deje en ese mes con una explicación. Entonces
    // `periodo` ("AAAA-MM") dice a qué certificado pertenece, sin importar la
    // fecha, y `motivoFueraDeCierre` guarda la explicación (que también se
    // anota en observación). Los partes comunes lo tienen en null: van por
    // fecha.
    periodo: { type: String, default: null },
    motivoFueraDeCierre: { type: String, trim: true, default: "" },

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

// Los partes se piden siempre por establecimiento y rango de fechas.
ParteDiarioSchema.index({ establecimiento: 1, fecha: 1, persona: 1 });

export default model("ParteDiario", ParteDiarioSchema);
