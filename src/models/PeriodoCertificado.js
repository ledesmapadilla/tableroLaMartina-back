import { Schema, model } from "mongoose";

// El certificado de un mes no cubre el mes calendario: en la planilla de abril
// 2026 los partes van del 26/03 al 25/04, y el corte cambia mes a mes. Por eso
// cada período guarda su propio desde/hasta, editable desde la pantalla.
const PeriodoCertificadoSchema = new Schema(
  {
    anio: { type: Number, required: true },
    mes: { type: Number, required: true, min: 1, max: 12 },
    desde: { type: Date, required: true },
    hasta: { type: Date, required: true },
    // Un certificado cerrado queda congelado: no se le agregan ni editan partes
    // hasta que alguien lo vuelva a abrir desde la pantalla.
    cerrado: { type: Boolean, default: false },
    fechaCierre: { type: Date, default: null },
  },
  { timestamps: true }
);

PeriodoCertificadoSchema.index({ anio: 1, mes: 1 }, { unique: true });

export default model("PeriodoCertificado", PeriodoCertificadoSchema);
