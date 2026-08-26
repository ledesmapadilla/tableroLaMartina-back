import { Schema, model } from "mongoose";

const KilometroColectivoSchema = new Schema(
  {
    colectivo:     { type: Schema.Types.ObjectId, ref: "Colectivo", required: true },
    cc:            { type: String, trim: true },
    fecha:         { type: Date, required: true },
    kilometraje:   { type: Number, required: true },
    // De donde salio la lectura: "manual" (+Km) o la fuente de la que se
    // materializo ("service"). Define si pisa a lo inferido.
    origen:        { type: String, trim: true, default: "manual" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

KilometroColectivoSchema.index({ colectivo: 1, fecha: -1, createdAt: -1 });
KilometroColectivoSchema.index({ cc: 1, fecha: -1 });

export default model("KilometroColectivo", KilometroColectivoSchema);
