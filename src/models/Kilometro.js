import { Schema, model } from "mongoose";

const KilometroSchema = new Schema(
  {
    camioneta:    { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    mes:          { type: Number },
    anio:         { type: Number },
    fecha:        { type: Date, required: true },
    responsable:  { type: String },
    kms:          { type: Schema.Types.Mixed, required: true },
    observaciones:{ type: String },
  },
  { timestamps: true }
);

KilometroSchema.index({ camioneta: 1, fecha: -1 });
KilometroSchema.index({ anio: 1, mes: 1 });

export default model("Kilometro", KilometroSchema);
