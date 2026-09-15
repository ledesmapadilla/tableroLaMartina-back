import Rol, { ROLES } from "../models/Rol.js";
import { limpiarCachePermisos } from "../permisos/resolver.js";

// El superadmin puede todo: no se configura.
const CONFIGURABLES = ROLES.filter((r) => r !== "superadmin");

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

// Los permisos de todos los roles, para la pantalla Roles (solo superadmin).
export const getAll = async (req, res) => {
  try {
    const roles = await Rol.find().lean();
    res.json(roles.map((r) => ({ rol: r.rol, permisos: aObjeto(r.permisos) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los del rol de quien está logueado: el front los pide al entrar.
export const getMio = async (req, res) => {
  try {
    const doc = await Rol.findOne({ rol: req.usuario.rol }).lean();
    res.json({ rol: req.usuario.rol, permisos: aObjeto(doc?.permisos) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reemplaza los permisos de un rol (solo superadmin).
export const update = async (req, res) => {
  try {
    const { rol } = req.params;
    if (!CONFIGURABLES.includes(rol)) {
      return res.status(400).json({ error: "Ese rol no se configura" });
    }
    const doc = await Rol.findOneAndUpdate(
      { rol },
      { rol, permisos: aLista(req.body?.permisos) },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    // El back toma el cambio enseguida (en esta instancia).
    limpiarCachePermisos(rol);
    res.json({ rol: doc.rol, permisos: aObjeto(doc.permisos) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
