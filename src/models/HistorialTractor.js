import { Schema, model } from "mongoose";

// Bitacora de cambios del alta de tractores. Cada edicion en TractoresAltas
// deja una fila por campo modificado, para poder reconstruir que se toco,
// cuando y desde que valor.
const HistorialTractorSchema = new Schema(
  {
    tractor:       { type: Schema.Types.ObjectId, ref: "Tractor", required: true },
    // Se guarda el CC del momento del cambio: si despues se renombra el
    // tractor, el historial sigue mostrando como se llamaba entonces.
    cc:            { type: String, trim: true },
    accion:        { type: String, enum: ["alta", "modificacion", "baja"], default: "modificacion" },
    campo:         { type: String, trim: true, default: "" },
    campoLabel:    { type: String, trim: true, default: "" },
    valorAnterior: { type: String, trim: true, default: "" },
    valorNuevo:    { type: String, trim: true, default: "" },
    fecha:         { type: Date, default: Date.now },
    // "app" = registrado en el momento del cambio.
    // "reconstruido" = cargado por el backfill a partir del seed original.
    origen:        { type: String, trim: true, default: "app" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

HistorialTractorSchema.index({ tractor: 1, fecha: -1, createdAt: -1 });
HistorialTractorSchema.index({ cc: 1, fecha: -1 });

export default model("HistorialTractor", HistorialTractorSchema);
