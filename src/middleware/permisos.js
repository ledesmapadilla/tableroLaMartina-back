import { puedeRol } from "../permisos/resolver.js";

const ESCRITURAS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Las escrituras de un recurso (crear, modificar, borrar) piden "Editar" en
 * la tabla de Roles, en alguna de las pantallas que escriben ahí. Varias
 * pantallas usan el mismo recurso, por eso alcanza con una.
 *
 * `claves` es una lista de claves de permisos/catalogo.js, o un objeto por
 * método ({ POST: [...], PUT: [...], DELETE: [...] }) cuando crear y
 * modificar son de pantallas distintas. Un método de escritura que no figura
 * en el objeto no se deja pasar.
 *
 * Las lecturas no piden nada más que la sesión: una pantalla lee datos de
 * otras (la planilla de certificación lee Variables aunque el rol no vea esa
 * pantalla), así que exigir "ver" en la API las rompería.
 */
export const escribirSi = (claves) => async (req, res, next) => {
  if (!ESCRITURAS.has(req.method)) return next();
  const lista = Array.isArray(claves) ? claves : claves[req.method];
  try {
    if (lista && (await puedeRol(req.usuario?.rol, lista, "editar"))) return next();
    return res.status(403).json({ error: "Tu rol no tiene permiso para editar esto" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
