import { Schema, model } from "mongoose";

const ParadaSchema = new Schema(
  {
    camioneta:     { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    fechaParada:   { type: Date, required: true },
    fechaArranque: { type: Date },
    motivo:        { type: String, trim: true },
  },
  { timestamps: true }
);

export default model("Parada", ParadaSchema);
