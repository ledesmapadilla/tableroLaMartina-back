import mongoose from "mongoose";

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: {
    type: String,
    enum: ["superadmin", "solicitante", "comprador", "analista", "gerente"],
    required: true,
  },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Usuario", usuarioSchema);
