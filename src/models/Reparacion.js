import { Schema, model } from "mongoose";

const ReparacionSchema = new Schema(
  {
    taller: { type: String, enum: ["sanpablo", "berdina"], required: true },
    vehiculo: { type: String, required: true },
    tipoVehiculo: { type: String, enum: ["camioneta", "tractor", "otro"] },
    fecha: { type: Date, default: Date.now },
    descripcion: { type: String },
    estado: {
      type: String,
      enum: ["pendiente", "en_proceso", "completada"],
      default: "pendiente",
    },
    costo: { type: Number },
    observaciones: { type: String },
  },
  { timestamps: true }
);

export default model("Reparacion", ReparacionSchema);
