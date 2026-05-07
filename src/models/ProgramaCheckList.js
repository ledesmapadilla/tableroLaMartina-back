import { Schema, model } from "mongoose";

const estadoMes = {
  estado:           { type: String, enum: ["pendiente", "realizado"], default: "pendiente" },
  puntuacion:       { type: Number, default: null },
  camionetatParada: { type: Boolean, default: false },
  tareaPendiente:   { type: Boolean, default: false },
};

const ProgramaCheckListSchema = new Schema(
  {
    camioneta:   { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    año:         { type: Number, required: true },
    enero:       estadoMes,
    marzo:       estadoMes,
    mayo:        estadoMes,
    julio:       estadoMes,
    septiembre:  estadoMes,
    noviembre:   estadoMes,
  },
  { timestamps: true }
);

ProgramaCheckListSchema.index({ camioneta: 1, año: 1 }, { unique: true });

export default model("ProgramaCheckList", ProgramaCheckListSchema);
