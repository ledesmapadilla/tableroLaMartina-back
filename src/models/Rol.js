import mongoose from "mongoose";

// Los roles fijos, los que vienen de Compras. Si se suma uno fijo, va también
// en las listas de permisos (acá, permisos/catalogo.js y, en el front,
// utils/permisos.js y NOMBRES_ROL). Los que se crean desde Altas › Usuarios ›
// Nuevo rol (07/11/2026) no van en ninguna lista: viven en esta colección con
// `personalizado: true` y su nombre.
export const ROLES = ["superadmin", "solicitante", "comprador", "analista", "gerente", "celular", "liquidacion", "supervisor"];

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
 * Roles. Un rol fijo sin documento, o una pantalla que no figura en él,
 * conserva el acceso que tenía antes de que existieran los permisos (lo
 * resuelve el front). El superadmin puede todo y no se guarda.
 *
 * Un rol nuevo (personalizado, 07/11/2026) nace sin nada, como celular o
 * supervisor, salvo que se lo cree copiando los permisos de otro. Las cosas
 * que dependen del nombre del rol (lo que hace el comprador, el analista, el
 * gerente…) siguen siendo de los fijos: el nuevo solo ve y edita pantallas.
 */
const rolSchema = new mongoose.Schema(
  {
    // Fijo, o la clave de uno nuevo: minúsculas, números y guiones.
    rol: { type: String, required: true, unique: true, trim: true, match: /^[a-z0-9][a-z0-9-]*$/ },
    nombre: { type: String, trim: true, default: "" },
    personalizado: { type: Boolean, default: false },
    permisos: { type: [permisoSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Rol", rolSchema, "roles");
