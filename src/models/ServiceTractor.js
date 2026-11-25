import { Schema, model } from "mongoose";

const ServiceTractorSchema = new Schema(
  {
    tractor:       { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    cc:            { type: String, trim: true },
    fecha:         { type: Date, required: true },
    responsable:   { type: String, trim: true, default: "" },
    horometro:     { type: Number, required: true },
    intervalo:     { type: Number, default: 250 },
    observaciones: { type: String, trim: true, default: "" },
    // Asentado solo para el control de services (24/11/2026): el horómetro es
    // menor al actual y el usuario eligió guardarlo igual. Cuenta para calcular
    // el próximo service, pero no es una lectura del horómetro: no entra en la
    // regla ni en el horómetro actual del tractor (horometros.service.js).
    soloControl:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

ServiceTractorSchema.index({ tractor: 1, fecha: -1, createdAt: -1 });
ServiceTractorSchema.index({ cc: 1, fecha: -1 });

export default model("ServiceTractor", ServiceTractorSchema);
