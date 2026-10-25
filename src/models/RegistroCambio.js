import { Schema, model } from "mongoose";

// Cuánto se guarda el registro (25/10/2026): un año. Lo borra solo Mongo con
// el índice TTL de `fecha` (se crea con npm run indexes).
export const DIAS_REGISTRO = 365;

// El antes y el después de un campo, o el documento entero en un alta o una
// baja. Van como texto JSON: lo que se guarda trae claves con puntos (los
// permisos de Roles, por ejemplo) que Mongo no acepta como objeto.
const CampoSchema = new Schema(
  {
    campo: { type: String, required: true },
    antes: { type: String, default: null },
    despues: { type: String, default: null },
  },
  { _id: false }
);

// Un documento tocado por el pedido, en las colecciones que guardan el antes
// y el después (services/historial.js): partes diarios y gasoil.
const CambioSchema = new Schema(
  {
    modelo: { type: String, required: true },
    docId: { type: String, default: "" },
    tipo: { type: String, enum: ["alta", "cambio", "baja"], required: true },
    // Los campos que cambiaron (solo en un cambio).
    campos: { type: [CampoSchema], default: [] },
    // El documento como quedó (alta) o como estaba (baja).
    doc: { type: String, default: null },
  },
  { _id: false }
);

/**
 * Quién hizo qué y cuándo (25/10/2026): un renglón por cada alta, cambio o
 * baja que llega a la API, y por cada intento de entrar al sistema. Lo anota
 * middleware/registro.js; las lecturas no se anotan.
 */
const RegistroCambioSchema = new Schema({
  fecha: { type: Date, required: true },
  usuario: { type: String, default: "" },
  nombre: { type: String, default: "" },
  rol: { type: String, default: "" },
  accion: { type: String, enum: ["alta", "cambio", "baja", "login"], required: true },
  metodo: { type: String, required: true },
  // La sección es lo que sigue a /api (partes, gasoil, op…); la ruta, entera.
  seccion: { type: String, default: "" },
  ruta: { type: String, default: "" },
  estado: { type: Number, default: null },
  ok: { type: Boolean, default: true },
  error: { type: String, default: "" },
  // Lo que mandó, sin contraseñas, en texto JSON.
  datos: { type: String, default: null },
  cambios: { type: [CambioSchema], default: [] },
  ip: { type: String, default: "" },
});

// El mismo índice sirve para ordenar de lo más nuevo a lo más viejo.
RegistroCambioSchema.index({ fecha: 1 }, { expireAfterSeconds: DIAS_REGISTRO * 24 * 3600, name: "vence_registro" });

export default model("RegistroCambio", RegistroCambioSchema);
