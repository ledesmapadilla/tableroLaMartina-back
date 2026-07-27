import { Schema, model } from "mongoose";

const VisitaSchema = new Schema(
  {
    fecha:         { type: String, required: true, trim: true }, // formato YYYY-MM-DD
    grupo:         { type: String, required: true, trim: true },
    cc:            { type: String, trim: true, default: "" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

VisitaSchema.index({ fecha: 1 });

export default model("Visita", VisitaSchema);
