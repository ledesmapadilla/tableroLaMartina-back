import { Schema, model } from "mongoose";

// Lo que se le descuenta a una persona en la certificación de un mes: los
// anticipos que ya cobró y la retención judicial que haya que practicarle.
// No sale de los partes, se carga a mano en el informe de tareas por personal
// y se resta de sus totales.
//
// Va por persona y por período (año/mes), no por parte: es un solo monto de
// cada uno para todo el mes.
const DescuentoPersonalSchema = new Schema(
  {
    persona: { type: Schema.Types.ObjectId, ref: "Personal", required: true },
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },

    descAntic: { type: Number, default: 0 },
    retJudicial: { type: Number, default: 0 },

    // Apagada con el ojo en el informe: la persona se sigue viendo, tachada,
    // pero queda afuera del total general. Se guarda acá para que la marca
    // aguante el refresco y sea la misma para todos.
    excluido: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Una sola fila por persona y mes: la pantalla la pisa cada vez que se edita.
DescuentoPersonalSchema.index({ anio: 1, mes: 1, persona: 1 }, { unique: true });

export default model("DescuentoPersonal", DescuentoPersonalSchema);
