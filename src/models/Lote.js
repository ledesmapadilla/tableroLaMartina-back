import { Schema, model } from "mongoose";
import { campoEstablecimiento } from "./Establecimiento.js";

// Los lotes de cada campo (17/09/2026).
//
// Hasta ahora el lote era texto libre en el parte. Se le da padrón porque en
// San Pablo el herbicida, el desmalezado y el pulverizado se pagan por lote
// terminado: lo que se reparte entre la gente que trabajó es la medida del
// lote, así que esa medida tiene que estar cargada en algún lado.
//
// Las dos medidas conviven porque las tareas se miden distinto: unas por
// planta y otras por hectárea. Cada una puede quedar vacía si todavía no se
// sabe.
const LoteSchema = new Schema(
  {
    // Los lotes son de un campo: el mismo nombre puede existir en los dos.
    establecimiento: campoEstablecimiento,
    nombre: { type: String, required: true, trim: true },
    hectareas: { type: Number, min: 0, default: null },
    plantas: { type: Number, min: 0, default: null },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// Los lotes se piden siempre por establecimiento, ordenados por nombre.
LoteSchema.index({ establecimiento: 1, nombre: 1 });

export default model("Lote", LoteSchema);
