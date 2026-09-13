import { Schema, model } from "mongoose";

// Documento único de configuración global de la app
const ConfigSchema = new Schema(
  {
    telefonoAviso: { type: String, default: "" },
    // Compras: desde este monto (sin IVA) un pedido analizado va a Gerencia
    // para autorizar; por debajo pasa al comprador. Solo lo cambian gerente y
    // superadmin, por su propia ruta.
    montoAutorizacion: { type: Number, default: 200000, min: 1 },
  },
  { timestamps: true }
);

export default model("Config", ConfigSchema);
