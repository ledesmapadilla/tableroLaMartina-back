import { Schema, model } from "mongoose";

const ItemSchema = new Schema(
  {
    nombre: String,
    estado: { type: String, enum: ["bien", "mal", ""], default: "" },
    observaciones: { type: String, default: "" },
  },
  { _id: false }
);

const CheckListSchema = new Schema(
  {
    camioneta: { type: Schema.Types.ObjectId, ref: "Camioneta", required: true },
    mes: { type: String },
    año: { type: Number },
    fecha: { type: Date, default: Date.now },
    numeroCc: String,
    kms: Number,
    encargado: String,
    kmsUltimoService: Number,
    fechaUltimoService: Date,
    documentacion: [ItemSchema],
    motor: [ItemSchema],
    pruebaMovimiento: [ItemSchema],
    estadoGeneral: [ItemSchema],
    puntuacion: { type: Number, min: 1, max: 10 },
    camionetatParada: { type: Boolean, default: false },
    tareaPendiente:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model("CheckList", CheckListSchema);
