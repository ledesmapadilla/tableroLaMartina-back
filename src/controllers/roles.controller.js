import Rol, { ROLES } from "../models/Rol.js";
import Usuario from "../models/Usuario.js";
import { limpiarCachePermisos, permisosDeRol } from "../permisos/resolver.js";

// Los fijos que se configuran: el superadmin puede todo y no se configura.
const FIJOS = ROLES.filter((r) => r !== "superadmin");

// Un rol se configura si es fijo (menos superadmin) o si se creó desde Nuevo
// rol (07/11/2026).
const esConfigurable = async (rol) => FIJOS.includes(rol) || Boolean(await Rol.exists({ rol, personalizado: true }));

// "compras.pedidos", "camionetas.ultimoService"...
const CLAVE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$/;

// La base guarda una lista; la API habla en objeto { clave: { ver, editar } }.
const aObjeto = (lista = []) =>
  Object.fromEntries(lista.map((p) => [p.clave, { ver: Boolean(p.ver), editar: Boolean(p.editar) }]));

// Solo claves con forma de permiso y valores sí/no. Editar sin ver no tiene
// sentido: editar implica ver.
const aLista = (permisos) =>
  Object.entries(permisos && typeof permisos === "object" ? permisos : {})
    .filter(([clave, v]) => CLAVE.test(clave) && v && typeof v === "object")
    .map(([clave, v]) => {
      const editar = v.editar === true;
      return { clave, ver: v.ver === true || editar, editar };
    });

// La clave de un rol nuevo, desde su nombre: "Encargado de riego" →
// "encargado-de-riego" (sin acentos ni signos).
const claveDe = (nombre) =>
  String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/**
 * Los permisos de todos los roles, para la pantalla Roles (solo superadmin).
 * Cada uno con su nombre y si es nuevo (`personalizado`); los nuevos van
 * siempre, aunque no tengan permisos.
 */
export const getAll = async (req, res) => {
  try {
    const roles = await Rol.find().lean();
    res.json(
      roles.map((r) => ({
        rol: r.rol,
        nombre: r.nombre || "",
        personalizado: Boolean(r.personalizado),
        permisos: aObjeto(r.permisos),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los del rol de quien está logueado: el front los pide al entrar.
export const getMio = async (req, res) => {
  try {
    const doc = await Rol.findOne({ rol: req.usuario.rol }).lean();
    res.json({ rol: req.usuario.rol, nombre: doc?.nombre || "", permisos: aObjeto(doc?.permisos) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reemplaza los permisos de un rol (solo superadmin).
export const update = async (req, res) => {
  try {
    const { rol } = req.params;
    if (!(await esConfigurable(rol))) {
      return res.status(400).json({ error: "Ese rol no se configura" });
    }
    const doc = await Rol.findOneAndUpdate(
      { rol },
      { $set: { rol, permisos: aLista(req.body?.permisos) } },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    // El back toma el cambio enseguida (en esta instancia).
    limpiarCachePermisos(rol);
    res.json({ rol: doc.rol, nombre: doc.nombre || "", personalizado: Boolean(doc.personalizado), permisos: aObjeto(doc.permisos) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * POST /api/roles  { nombre, copiarDe? } — crea un rol nuevo (07/11/2026,
 * solo superadmin). Nace sin nada, como celular o supervisor, o con los
 * permisos que hoy tiene `copiarDe` (uno fijo o uno nuevo; del superadmin no,
 * que puede todo). No puede repetir el nombre ni la clave de otro.
 */
export const create = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim().replace(/\s+/g, " ");
    if (!nombre) return res.status(400).json({ error: "Falta el nombre del rol." });
    if (nombre.length > 40) return res.status(400).json({ error: "El nombre no puede pasar de 40 caracteres." });
    const rol = claveDe(nombre);
    if (!rol) return res.status(400).json({ error: "El nombre tiene que tener letras o números." });
    if (ROLES.includes(rol) || (await Rol.exists({ rol }))) {
      return res.status(409).json({ error: "Ya hay un rol con ese nombre." });
    }
    const repetido = await Rol.exists({ personalizado: true, nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (repetido) return res.status(409).json({ error: "Ya hay un rol con ese nombre." });

    let permisos = [];
    const copiarDe = String(req.body?.copiarDe || "").trim();
    if (copiarDe) {
      if (!(await esConfigurable(copiarDe))) return res.status(400).json({ error: "El rol a copiar no existe." });
      // Lo que ese rol puede hoy: lo de antes pisado por lo guardado.
      permisos = aLista(await permisosDeRol(copiarDe));
    }
    const doc = await Rol.create({ rol, nombre, personalizado: true, permisos });
    res.status(201).json({ rol: doc.rol, nombre: doc.nombre, personalizado: true, permisos: aObjeto(doc.permisos) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * DELETE /api/roles/:rol — borra un rol nuevo (solo superadmin). Los fijos
 * no se borran, y uno que tenga usuarios tampoco: primero hay que pasarlos a
 * otro rol.
 */
export const remove = async (req, res) => {
  try {
    const { rol } = req.params;
    const doc = await Rol.findOne({ rol }).lean();
    if (!doc?.personalizado) return res.status(400).json({ error: "Solo se pueden borrar los roles nuevos." });
    const enUso = await Usuario.countDocuments({ rol });
    if (enUso) {
      return res
        .status(409)
        .json({ error: `Lo ${enUso === 1 ? "tiene 1 usuario" : `tienen ${enUso} usuarios`}: primero hay que pasarlos a otro rol.` });
    }
    await Rol.deleteOne({ rol });
    limpiarCachePermisos(rol);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
