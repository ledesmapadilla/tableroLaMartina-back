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

// Los tipos de gasoil (27/10/2026): San Pablo tiene dos tanques, Común e
// Infinia, cada uno con su stock inicial, sus ingresos, sus consumos y su
// auditoría. Berdina, solo Común. Un tanque es un campo + un tipo. Lo cargado
// antes no tiene tipo: es Común.
export const TIPOS_GASOIL = ["comun", "infinia"];
export const TIPOS_DE_CAMPO = { berdina: ["comun"], sanpablo: ["comun", "infinia"] };
// Los tanques, en el orden en que se muestran.
export const TANQUES_GASOIL = CAMPOS_GASOIL.flatMap((campo) => TIPOS_DE_CAMPO[campo].map((tipo) => ({ campo, tipo })));
// El Infinia lo consume solo la retro: los partes de este CC (por su código).
// Sus litros no van al Común.
export const CC_INFINIA = "Retro";
// El campo `tipo` de los modelos de Gasoil.
export const campoTipo = { type: String, enum: TIPOS_GASOIL, default: "comun" };

const GasoilDiaSchema = new Schema(
  {
    campo: { type: String, enum: CAMPOS_GASOIL, required: [true, "Falta el campo"] },
    tipo: campoTipo,
    fecha: { type: Date, required: [true, "Falta la fecha"] },
    observaciones: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true }
);

GasoilDiaSchema.index({ campo: 1, tipo: 1, fecha: 1 }, { unique: true });

export default model("GasoilDia", GasoilDiaSchema);
