import { Schema, model } from "mongoose";

const HorometroTractorSchema = new Schema(
  {
    tractor:       { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    cc:            { type: String, trim: true },
    fecha:         { type: Date, required: true },
    horometro:     { type: Number, required: true },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

HorometroTractorSchema.index({ tractor: 1, fecha: -1, createdAt: -1 });
HorometroTractorSchema.index({ cc: 1, fecha: -1 });

export default model("HorometroTractor", HorometroTractorSchema);
