import Rol from "../models/Rol.js";
import { PERMISOS_HOY } from "./catalogo.js";

// Los permisos de cada rol se guardan un rato en memoria para no leer la base
// en cada pedido. Al guardar desde la pantalla Roles se limpia (en el deploy
// de Vercel cada instancia tiene su copia: a lo sumo tarda esto en enterarse).
const DURACION_MS = 30 * 1000;
const cache = new Map(); // rol -> { vence, permisos }

export const limpiarCachePermisos = (rol) => (rol ? cache.delete(rol) : cache.clear());

/**
 * Los permisos de un rol ({ clave: { ver, editar } }): el acceso de antes
 * (catalogo.js) pisado, pantalla por pantalla, por lo guardado en Roles.
 * Editar implica ver.
 */
export const permisosDeRol = async (rol) => {
  const guardado = cache.get(rol);
  if (guardado && guardado.vence > Date.now()) return guardado.permisos;

  const permisos = {};
  for (const [clave, roles] of Object.entries(PERMISOS_HOY)) {
    const entra = roles.includes(rol);
    permisos[clave] = { ver: entra, editar: entra };
  }
  const doc = await Rol.findOne({ rol }).lean();
  for (const p of doc?.permisos || []) {
    if (p.clave in permisos) permisos[p.clave] = { ver: Boolean(p.ver || p.editar), editar: Boolean(p.editar) };
  }

  cache.set(rol, { vence: Date.now() + DURACION_MS, permisos });
  return permisos;
};

/** Si el rol puede la acción en alguna de las pantallas. El superadmin puede todo. */
export const puedeRol = async (rol, claves, accion = "ver") => {
  if (rol === "superadmin") return true;
  if (!rol) return false;
  const permisos = await permisosDeRol(rol);
  return [].concat(claves).some((c) => Boolean(permisos[c]?.[accion]));
};
