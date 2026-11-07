import { Schema, model } from "mongoose";

// Tareas de Producción: el listado de trabajos que se cargan en la planilla,
// con la unidad en la que se miden y la empresa que las realiza.
const TareaSchema = new Schema(
  {
    tarea: { type: String, required: true, trim: true },
    unidad: { type: String, required: true, trim: true },
    empresa: { type: String, trim: true },
    // Una tarea que cobra lo mismo que otra (07/11/2026): "Horas Motor
    // Generador" va con el precio de "Horas La Martina". No tiene precios
    // propios en Variables: en todos lados se usa el de la otra, en cada campo,
    // cliente y vigencia, así cuando cambia una cambia la otra.
    mismoPrecioQue: { type: Schema.Types.ObjectId, ref: "Tarea", default: null },
  },
  { timestamps: true }
);

export default model("Tarea", TareaSchema);
