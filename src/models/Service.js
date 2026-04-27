import { Schema, model } from "mongoose";

const ServiceSchema = new Schema(
  {
    camioneta:    { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    fecha:        { type: Date, required: true },
    responsable:  { type: String },
    kms:          { type: Number },
    observaciones:{ type: String },
  },
  { timestamps: true }
);

export default model("Service", ServiceSchema);
