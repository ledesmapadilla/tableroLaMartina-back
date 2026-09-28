import { Schema, model } from "mongoose";
import { MOVIMIENTOS } from "../catalogos/almacen.js";

/**
 * Las compras y los consumos de un aceite (28/09/2026).
 *
 * Una compra es una entrada y un consumo, una salida: son los mismos dos
 * movimientos del almacén de repuestos, pero cada uno guarda cosas distintas.
 * La compra lleva proveedor, marca y precio; el consumo, a qué equipo fue
 * (grupo y C.C.). Lo que no le corresponde queda vacío.
 */
const MovimientoAceiteSchema = new Schema(
  {
    aceite: { type: Schema.Types.ObjectId, ref: "Aceite", required: true, index: true },
    movimiento: { type: String, required: true, enum: MOVIMIENTOS },
    fecha: { type: Date, required: true },
    litros: { type: Number, required: true, min: 0.01 },
    // Compra
    proveedor: { type: String, trim: true, default: "" },
    marca: { type: String, trim: true, default: "" },
    // Lo que se pagó en total, no por litro: el $/L sale de la cuenta.
    precio: { type: Number, default: null },
    // Consumo. En el Sistema de Gestión era la máquina; acá es el centro de
    // costo, que se elige después del grupo. "Berdina" va al taller y no
    // lleva C.C.
    grupo: { type: String, trim: true, default: "" },
    cc: { type: String, trim: true, default: "" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("MovimientoAceite", MovimientoAceiteSchema);
