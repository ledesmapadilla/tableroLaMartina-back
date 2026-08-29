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
  },
  { timestamps: true }
);

export default model("CentroCosto", CentroCostoSchema);
