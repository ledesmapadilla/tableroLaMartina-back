import mongoose from "mongoose";

// Los mismos roles que Usuario. Si se suma uno, va también en el enum de
// Usuario y en las listas de permisos (acá, permisos/catalogo.js y, en el
// front, utils/permisos.js y NOMBRES_ROL).
export const ROLES = ["superadmin", "solicitante", "comprador", "analista", "gerente", "celular", "liquidacion"];

// Un permiso: una pantalla o tarjeta del proyecto (la clave sale de
// TableroFront/src/utils/permisosCatalogo.js) y si el rol la ve y la edita.
// Va como lista y no como objeto: las claves llevan puntos
// ("compras.pedidos") y Mongo los toma como rutas anidadas.
const permisoSchema = new mongoose.Schema(
  {
    clave: { type: String, required: true, trim: true },
    ver: { type: Boolean, default: false },
    editar: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Lo que puede cada rol. Lo edita el superadmin desde Altas › Usuarios ›
 * Roles. Un rol sin documento, o una pantalla que no figura en él, conserva
 * el acceso que tenía antes de que existieran los permisos (lo resuelve el
 * front). El superadmin puede todo y no se guarda.
 */
const rolSchema = new mongoose.Schema(
  {
    rol: { type: String, enum: ROLES, required: true, unique: true },
    permisos: { type: [permisoSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Rol", rolSchema, "roles");
