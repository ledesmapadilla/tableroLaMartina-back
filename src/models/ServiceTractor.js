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
  },
  { timestamps: true }
);

ServiceTractorSchema.index({ tractor: 1, fecha: -1, createdAt: -1 });
ServiceTractorSchema.index({ cc: 1, fecha: -1 });

export default model("ServiceTractor", ServiceTractorSchema);
