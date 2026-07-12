import { Schema, model } from "mongoose";

const TrabajoCamionetaSchema = new Schema(
  {
    camioneta:   { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    fecha:       { type: Date, required: true },
    reparacion:  { type: String, default: "" },
    descripcion: { type: String, default: "" },
    parte:       { type: String, default: "" },
    prioridad:   { type: String, default: "Normal" },
    estado:      { type: String, default: "Pendiente" },
    responsable: { type: String, default: "" },
    observaciones: { type: String, default: "" },
    maquinaParada: { type: Boolean, default: false },
    repuestos: [{
      repuesto:     { type: String, default: "" },
      cantidad:     { type: Number, default: 1 },
      precio:       { type: Number, default: 0 },
      proveedor:    { type: String, default: "" },
      responsable:  { type: String, default: "" },
      estado:       { type: String, default: "Pedido" },
      observaciones:{ type: String, default: "" },
    }],
  },
  { timestamps: true }
);

export default model("TrabajoCamioneta", TrabajoCamionetaSchema);
