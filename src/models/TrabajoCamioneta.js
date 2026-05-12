import { Schema, model } from "mongoose";

const TrabajoCamionetaSchema = new Schema(
  {
    camioneta:   { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    fecha:       { type: Date, required: true },
    descripcion: { type: String, required: true },
    repuestos: [{
      nombre:       { type: String, default: "" },
      costo:        { type: Number, default: null },
      observaciones:{ type: String, default: "" },
    }],
    detalle:     { type: String, default: "" },
    estado:      { type: String, enum: ["pendiente", "terminada"], default: "pendiente" },
    urgencia:    { type: String, enum: ["baja", "media", "alta"], default: "baja" },
  },
  { timestamps: true }
);

export default model("TrabajoCamioneta", TrabajoCamionetaSchema);
