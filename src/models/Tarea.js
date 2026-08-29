import { Schema, model } from "mongoose";

// Tareas de Producción: el listado de trabajos que se cargan en la planilla,
// con la unidad en la que se miden y la empresa que las realiza.
const TareaSchema = new Schema(
  {
    tarea: { type: String, required: true, trim: true },
    unidad: { type: String, required: true, trim: true },
    empresa: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model("Tarea", TareaSchema);
