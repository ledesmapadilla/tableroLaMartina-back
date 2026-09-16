import { Schema, model } from "mongoose";

const CamionetaSchema = new Schema(
  {
    patente: { type: String, required: true, uppercase: true, trim: true, unique: true },
    // No es obligatoria: la camioneta nace al dar de alta su CC y la marca se
    // completa después en Camionetas.
    marca: { type: String, default: "" },
    modelo: { type: String },
    año: { type: Number },
    estado: {
      type: String,
      enum: ["operativo", "en_reparacion", "fuera_de_servicio"],
      default: "operativo",
    },
    responsable:      { type: String },
    telefono:         { type: String, default: "" },
    callmebotApiKey:  { type: String, default: "" },
    serviceNotificado:{ type: Boolean, default: false },
    observaciones:    { type: String },
  },
  { timestamps: true }
);

export default model("Camioneta", CamionetaSchema);
