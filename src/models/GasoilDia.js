import { Schema, model } from "mongoose";

// Compras › Gasoil (20/10/2026): las observaciones de un día de la planilla
// de consumos, un documento por campo y día. Ni el consumo ni el saldo se
// guardan acá: el consumo sale de los partes de Producción (combustible +
// combTurbo) y el saldo de restarle los consumos a los ingresos
// (IngresoGasoil). Ver gasoil.controller.js.
//
// Cada campo de Gasoil es un establecimiento de los partes.
export const ESTABLECIMIENTO_DE_CAMPO = { berdina: "caspinchango", sanpablo: "san-pablo" };
export const CAMPOS_GASOIL = Object.keys(ESTABLECIMIENTO_DE_CAMPO);

const GasoilDiaSchema = new Schema(
  {
    campo: { type: String, enum: CAMPOS_GASOIL, required: [true, "Falta el campo"] },
    fecha: { type: Date, required: [true, "Falta la fecha"] },
    observaciones: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true }
);

GasoilDiaSchema.index({ campo: 1, fecha: 1 }, { unique: true });

export default model("GasoilDia", GasoilDiaSchema);
