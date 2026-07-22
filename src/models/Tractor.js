import { Schema, model } from "mongoose";

const TractorSchema = new Schema(
  {
    cc: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    supervisor: { type: String, trim: true },
    encargadoGral: { type: String, trim: true },
    gruppo: { type: Number, default: 6, min: 1, max: 7 },
  },
  { timestamps: true }
);

export default model("Tractor", TractorSchema);
