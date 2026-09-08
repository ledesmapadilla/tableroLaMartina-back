import mongoose from "mongoose";

const proveedorSchema = new mongoose.Schema({
  razonsocial: { type: String, required: true },
  contacto: { type: String, required: true },
  rubro: { type: String, required: true },
  cuit: { type: String },
  email: { type: String },
  telefono: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

export default mongoose.model("Proveedor", proveedorSchema);
