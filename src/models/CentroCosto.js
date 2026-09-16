import { Schema, model } from "mongoose";

// Centro de costos de La Martina. Es un padrón único, compartido por
// Producción y por Compras: los dos venían llevándolo por separado y se
// fusionaron al unificar los proyectos (06/09/2026).
//
// Cada sector mantiene sus campos y ve los del otro:
//   - Producción → equipo, descripcion, tractor
//   - Compras    → grupo, marca, observaciones
//
// El grupo no se carga a mano: sale del equipo (catalogos/equipos.js, desde el
// 16/09/2026), así los dos quedan siempre de acuerdo.
//
// Sin bitácora de cambios: acá no se lleva historial. El listado de equipos
// vive en catalogos/equipos.js, así sumar uno nuevo no obliga a tocar el
// modelo.
const CentroCostoSchema = new Schema(
  {
    cc: { type: String, required: true, trim: true },
    equipo: { type: String, trim: true },
    descripcion: { type: String, trim: true },

    // Los que mantiene Compras. Van con default "" y no requeridos: los CC que
    // se dan de alta desde Producción no los cargan.
    grupo: { type: String, trim: true, default: "" },
    marca: { type: String, trim: true, default: "" },
    observaciones: { type: String, trim: true, default: "" },
    // Enlace al padrón que manda cuando el CC es un equipo gestionado. Hasta
    // acá el vínculo era que el CC estuviera escrito igual en los dos lados;
    // con esto el cruce de horómetros con Tractores es una relación real.
    tractor: { type: Schema.Types.ObjectId, ref: "Tractor", default: null },
  },
  { timestamps: true }
);

CentroCostoSchema.index({ tractor: 1 });

export default model("CentroCosto", CentroCostoSchema);
