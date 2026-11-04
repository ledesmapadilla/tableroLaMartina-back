import { Schema, model } from "mongoose";

/**
 * Guía de tareas (04/11/2026): qué tarea del padrón corresponde a cada
 * trabajo que se hace en el campo. Se consulta con el "?" al lado de Tarea en
 * la planilla de carga, para usar una tarea que ya existe en vez de dar de
 * alta otra.
 */
const GuiaTareaSchema = new Schema(
  {
    descripcion: { type: String, required: true, trim: true },
    tarea: { type: Schema.Types.ObjectId, ref: "Tarea", required: true },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("GuiaTarea", GuiaTareaSchema);
