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

// Incluye createdAt (el desempate cuando hay dos services con la misma fecha)
// para que getUltimos resuelva con DISTINCT_SCAN en vez de COLLSCAN + sort.
// Reemplaza a {camioneta:1, fecha:-1}, del que es prefijo.
ServiceSchema.index({ camioneta: 1, fecha: -1, createdAt: -1 });

export default model("Service", ServiceSchema);
