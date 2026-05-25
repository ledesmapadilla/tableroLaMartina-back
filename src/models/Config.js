import { Schema, model } from "mongoose";

// Documento único de configuración global de la app
const ConfigSchema = new Schema(
  {
    telefonoAviso: { type: String, default: "" },
  },
  { timestamps: true }
);

export default model("Config", ConfigSchema);
