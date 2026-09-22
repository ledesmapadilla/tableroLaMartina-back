import { Schema, model } from "mongoose";
import { MOVIMIENTOS } from "../catalogos/almacen.js";

/**
 * Las entradas y salidas de un filtro del almacén (22/09/2026).
 *
 * La existencia del filtro es el saldo: cada movimiento la sube o la baja, y
 * acá queda el detalle de quién se llevó qué y para qué centro de costo. Los
 * dos movimientos guardan los mismos campos; lo que cambia es cómo se leen:
 * en una salida `persona` es quien retira y en una entrada, quien entrega.
 */
export { MOVIMIENTOS };

const MovimientoFiltroSchema = new Schema(
  {
    filtro: { type: Schema.Types.ObjectId, ref: "Filtro", required: true, index: true },
    movimiento: { type: String, required: true, enum: MOVIMIENTOS },
    fecha: { type: Date, required: true },
    persona: { type: String, trim: true, default: "" },
    // A dónde va lo que sale. El grupo se pide primero y acota la lista de
    // centros de costo, que son muchos. Puede ser "Berdina": ahí el filtro va
    // al taller y no a un equipo, así que se queda sin CC.
    grupo: { type: String, trim: true, default: "" },
    cc: { type: String, trim: true, default: "" },
    cantidad: { type: Number, required: true, min: 1 },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("MovimientoFiltro", MovimientoFiltroSchema);
