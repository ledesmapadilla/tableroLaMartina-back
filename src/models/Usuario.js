import mongoose from "mongoose";

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Uno fijo (Rol.js, ROLES) o uno creado desde Altas › Usuarios › Nuevo
  // rol (07/11/2026). Que exista lo controla usuario.controller.js.
  rol: {
    type: String,
    required: true,
    trim: true,
  },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Usuario", usuarioSchema);
