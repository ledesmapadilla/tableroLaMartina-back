import { Schema, model } from "mongoose";

// Centro de costos de Producción. Misma idea que el alta de tractores, pero
// sin bitácora de cambios: acá no se lleva historial.
// El listado de equipos vive en el front (ProduccionAltaCC), así sumar uno
// nuevo no obliga a tocar el modelo.
const CentroCostoSchema = new Schema(
  {
    cc: { type: String, required: true, trim: true },
    equipo: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    // Enlace al padrón que manda cuando el CC es un equipo gestionado. Hasta
    // acá el vínculo era que el CC estuviera escrito igual en los dos lados;
    // con esto el cruce de horómetros con Tractores es una relación real.
    tractor: { type: Schema.Types.ObjectId, ref: "Tractor", default: null },
  },
  { timestamps: true }
);

CentroCostoSchema.index({ tractor: 1 });

export default model("CentroCosto", CentroCostoSchema);
