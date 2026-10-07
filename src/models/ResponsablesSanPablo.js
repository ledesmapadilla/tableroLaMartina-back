import { Schema, model } from "mongoose";

// Los responsables de una pantalla de Reparaciones San Pablo en una cosecha
// (06/10/2026): por ahora solo Manitous › General. Uno por documento de
// cosecha + sección, con los nombres en el orden en que se cargaron.
const ResponsablesSanPabloSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    seccion: { type: String, trim: true, required: true },
    nombres: { type: [{ type: String, trim: true }], default: [] },
  },
  { timestamps: true }
);

ResponsablesSanPabloSchema.index({ cosecha: 1, seccion: 1 }, { unique: true });

export default model("ResponsablesSanPablo", ResponsablesSanPabloSchema);
