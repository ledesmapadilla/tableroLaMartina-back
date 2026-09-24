import { Schema, model } from "mongoose";

// Los valores admisibles de cada tarea (24/09/2026): contra ellos se mide el
// desvío del consumo y del rendimiento. Son una de las tres tarjetas de
// Variables y, como Remuneración, valen para todos los campos y todos los
// meses.
//
// Una sola fila por tarea. El rendimiento por litro (unidad / lts) no se
// guarda: sale de dividir el rendimiento por hora por el consumo por hora, y
// lo calcula la pantalla.
const AdmisibleSchema = new Schema(
  {
    tarea: { type: Schema.Types.ObjectId, ref: "Tarea", required: true, unique: true },
    // Litros por hora de trabajo que se aceptan como normales.
    consumo: { type: Number, min: 0, default: null },
    // Unidades de la tarea (plantas, hectáreas, tancadas…) por hora.
    rendimiento: { type: Number, min: 0, default: null },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("Admisible", AdmisibleSchema);
