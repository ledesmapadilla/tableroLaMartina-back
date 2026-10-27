import { Schema, model } from "mongoose";
import { CAMPOS_GASOIL, campoTipo } from "./GasoilDia.js";

// Compras › Gasoil (20/10/2026): el gasoil que entra al tanque de un campo.
// Con estos y los consumos de los partes se calcula el saldo de cada día.
const IngresoGasoilSchema = new Schema(
  {
    campo: { type: String, enum: CAMPOS_GASOIL, required: [true, "Falta el campo"] },
    // A qué tanque entra (27/10/2026): en San Pablo, Común o Infinia.
    tipo: campoTipo,
    fecha: { type: Date, required: [true, "Falta la fecha"] },
    // La razón social del padrón de proveedores, como texto.
    proveedor: { type: String, trim: true, default: "" },
    // El número del remito o del ticket de la carga.
    remito: { type: String, trim: true, maxlength: 40, default: "" },
    litros: {
      type: Number,
      required: [true, "Faltan los litros"],
      min: [0.01, "Los litros tienen que ser más que cero"],
    },
    // Quién hizo la carga en el tanque.
    quienCarga: { type: String, trim: true, default: "" },
    observaciones: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true }
);

IngresoGasoilSchema.index({ campo: 1, fecha: -1 });

export default model("IngresoGasoil", IngresoGasoilSchema);
