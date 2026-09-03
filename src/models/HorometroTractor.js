import { Schema, model } from "mongoose";

const HorometroTractorSchema = new Schema(
  {
    tractor:       { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    cc:            { type: String, trim: true },
    fecha:         { type: Date, required: true },
    horometro:     { type: Number, required: true },
    // De donde salio la lectura: "manual" (+Horom.) o la fuente de la que se
    // materializo ("visita" / "reparacion"). Define si pisa a lo inferido.
    origen:        { type: String, trim: true, default: "manual" },
    // Parte diario que generó esta lectura, cuando el origen es "produccion".
    // Sirve para deshacerla si después se borra o se edita ese parte.
    parte:         { type: Schema.Types.ObjectId, ref: "ParteDiario", default: null },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

HorometroTractorSchema.index({ tractor: 1, fecha: -1, createdAt: -1 });
HorometroTractorSchema.index({ cc: 1, fecha: -1 });
HorometroTractorSchema.index({ parte: 1 });

export default model("HorometroTractor", HorometroTractorSchema);
