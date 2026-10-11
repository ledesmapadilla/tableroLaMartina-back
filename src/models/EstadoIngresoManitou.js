import { Schema, model } from "mongoose";

// Una tarea del estado de ingreso: un problema que trajo la máquina y si ya
// se solucionó.
const TareaIngresoSchema = new Schema(
  {
    texto: { type: String, trim: true, required: true },
    solucionado: { type: Boolean, default: false },
  },
  { _id: true }
);

// El estado de ingreso de un sistema de una Manitou en una cosecha
// (10/10/2026): las tareas con los problemas que trajo la máquina cuando se
// la ingresó, cada una con su círculo de solucionado. Uno por cosecha +
// Manitou + sistema; General (la plantilla) no tiene.
const EstadoIngresoManitouSchema = new Schema(
  {
    cosecha: { type: Number, required: true, min: 2026 },
    seccion: { type: String, trim: true, required: true },
    sistema: { type: String, trim: true, required: true },
    tareas: { type: [TareaIngresoSchema], default: [] },
  },
  { timestamps: true }
);

EstadoIngresoManitouSchema.index({ cosecha: 1, seccion: 1, sistema: 1 }, { unique: true });

export default model("EstadoIngresoManitou", EstadoIngresoManitouSchema);
