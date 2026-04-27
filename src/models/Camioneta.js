import { Schema, model } from "mongoose";

const CamionetaSchema = new Schema(
  {
    patente: { type: String, required: true, uppercase: true, trim: true, unique: true },
    marca: { type: String, required: true },
    modelo: { type: String },
    año: { type: Number },
    estado: {
      type: String,
      enum: ["operativo", "en_reparacion", "fuera_de_servicio"],
      default: "operativo",
    },
    responsable: { type: String },
    observaciones: { type: String },
  },
  { timestamps: true }
);

export default model("Camioneta", CamionetaSchema);
