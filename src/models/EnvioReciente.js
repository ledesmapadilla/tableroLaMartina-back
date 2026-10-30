import { Schema, model } from "mongoose";

// Cuánto se recuerda un alta (29/10/2026): si en ese lapso llega otra igual,
// es la misma que se reintentó y no se guarda dos veces.
export const VENTANA_ENVIO_MS = 2 * 60 * 1000;

// Un alta reciente (POST), para no guardarla dos veces. El _id es la huella
// del pedido (usuario + ruta + datos): al ser _id es única sin necesitar un
// índice aparte. Mientras se guarda está "enCurso"; cuando sale bien queda
// "listo" con la respuesta, que es lo que recibe el reintento. Si sale mal se
// borra, para que se pueda volver a intentar.
const EnvioRecienteSchema = new Schema(
  {
    _id: { type: String },
    fecha: { type: Date, required: true },
    estado: { type: String, enum: ["enCurso", "listo"], required: true },
    status: { type: Number },
    cuerpo: { type: String },
  },
  { versionKey: false }
);

// Mongo los borra solo pasado un rato (se crea con npm run indexes). Sin el
// índice igual funciona: uno vencido se pisa al llegar otro igual.
EnvioRecienteSchema.index({ fecha: 1 }, { expireAfterSeconds: 10 * 60, name: "vence_envio" });

export default model("EnvioReciente", EnvioRecienteSchema);
