import { Schema, model } from "mongoose";
import { campoEstablecimiento } from "./Establecimiento.js";

// Los valores con los que se certifica cada tarea. El precio es único para
// todos: no distingue cliente (17/09/2026). Cada carga es una fila: el precio
// vigente de una tarea es el de la última vigencia y las anteriores quedan como
// historial (04/09/2026). Por eso la tarea NO tiene índice único: tiene un
// valor por cada vez que cambió.
const VariableTareaSchema = new Schema(
  {
    // La misma tarea puede valer distinto en cada campo.
    establecimiento: campoEstablecimiento,
    tarea: { type: Schema.Types.ObjectId, ref: "Tarea", required: true },
    // El precio unitario de la tarea, en pesos. El que se carga es el neto; el
    // bruto lo calcula el backend con la retención y se guarda para no tener
    // que rehacer la cuenta en cada pantalla.
    neto: { type: Number, default: null },
    bruto: { type: Number, default: null },

    // Cuándo se cargó el valor: queda como dato de la carga.
    fecha: { type: Date, default: null },
    // Desde cuándo se aplica a los partes. Puede ser anterior a la fecha de
    // carga: el precio se acuerda antes y se carga después. Es lo que ordena
    // el historial y define cuál es el vigente.
    vigenciaDesde: { type: Date, default: null },
  },
  { timestamps: true }
);

// El historial se lee siempre por tarea, de la vigencia más nueva a la más
// vieja.
VariableTareaSchema.index({ establecimiento: 1, tarea: 1, vigenciaDesde: -1 });

export default model("VariableTarea", VariableTareaSchema);
