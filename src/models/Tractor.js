import { Schema, model } from "mongoose";

const TractorSchema = new Schema(
  {
    identificador: { type: String, required: true, trim: true },
    marca: { type: String },
    modelo: { type: String },
    año: { type: Number },
    estado: {
      type: String,
      enum: ["operativo", "en_reparacion", "fuera_de_servicio"],
      default: "operativo",
    },
    observaciones: { type: String },
  },
  { timestamps: true }
);

export default model("Tractor", TractorSchema);
