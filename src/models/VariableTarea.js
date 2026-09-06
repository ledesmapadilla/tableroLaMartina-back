import { Schema, model } from "mongoose";

// Los valores con los que se certifica cada tarea, por cliente. Cada carga es
// una fila: el precio vigente de una tarea es el de la última vigencia y las
// anteriores quedan como historial (04/09/2026). Por eso la tarea NO tiene
// índice único: una misma tarea tiene un valor por cliente y varios en el
// tiempo.
const VariableTareaSchema = new Schema(
  {
    tarea: { type: Schema.Types.ObjectId, ref: "Tarea", required: true },
    // A quién se le certifica ese precio. Texto libre, igual que en el parte:
    // no hay padrón de clientes, salen de lo que se carga en la planilla.
    cliente: { type: String, trim: true, default: "" },

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

// El historial se lee siempre por tarea y cliente, de la vigencia más nueva a
// la más vieja.
VariableTareaSchema.index({ tarea: 1, cliente: 1, vigenciaDesde: -1 });

export default model("VariableTarea", VariableTareaSchema);
