import { Schema, model } from "mongoose";

// Una alternativa de un filtro: la marca y su código.
const AlternativaSchema = new Schema(
  {
    marca: { type: String, trim: true, default: "" },
    codigo: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Los repuestos de cada unidad de Tractores (tractores, manitou y camiones).
// Por ahora los filtros: para cada uno, hasta 3 marcas posibles con su código.
// Va aparte del Tractor para no mezclarlo con el alta, que lleva historial de
// cambios, y para poder sumar otros repuestos más adelante.
const RepuestoTractorSchema = new Schema(
  {
    tractor: { type: Schema.Types.ObjectId, ref: "Tractor", required: true, unique: true },
    filtroAire: { type: [AlternativaSchema], default: [] },
    filtroCombustible: { type: [AlternativaSchema], default: [] },
    filtroAceite: { type: [AlternativaSchema], default: [] },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("RepuestoTractor", RepuestoTractorSchema);
