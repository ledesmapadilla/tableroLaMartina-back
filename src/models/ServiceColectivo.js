import { Schema, model } from "mongoose";

const ServiceColectivoSchema = new Schema(
  {
    colectivo:     { type: Schema.Types.ObjectId, ref: "Colectivo", required: true },
    cc:            { type: String, trim: true },
    fecha:         { type: Date, required: true },
    responsable:   { type: String, trim: true, default: "" },
    kilometraje:   { type: Number, required: true },
    intervalo:     { type: Number, default: 10000 },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

ServiceColectivoSchema.index({ colectivo: 1, fecha: -1, createdAt: -1 });
ServiceColectivoSchema.index({ cc: 1, fecha: -1 });

export default model("ServiceColectivo", ServiceColectivoSchema);
