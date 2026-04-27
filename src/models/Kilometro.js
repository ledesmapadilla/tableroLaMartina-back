import { Schema, model } from "mongoose";

const KilometroSchema = new Schema(
  {
    camioneta:    { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    mes:          { type: Number },
    anio:         { type: Number },
    fecha:        { type: Date, required: true },
    responsable:  { type: String },
    kms:          { type: Number, required: true },
    observaciones:{ type: String },
  },
  { timestamps: true }
);

export default model("Kilometro", KilometroSchema);
