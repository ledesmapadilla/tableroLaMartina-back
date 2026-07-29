import { Schema, model } from "mongoose";

const TrabajoTractorSchema = new Schema(
  {
    tractor:     { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    fecha:       { type: Date, required: true },
    reparacion:  { type: String, default: "" },
    diagnostico: { type: String, default: "" },
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

TrabajoTractorSchema.index({ tractor: 1, fecha: -1 });
TrabajoTractorSchema.index({ estado: 1 });

export default model("TrabajoTractor", TrabajoTractorSchema);
