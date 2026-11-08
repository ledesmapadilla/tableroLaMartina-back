import Usuario from "../models/Usuario.js";
import Rol, { ROLES } from "../models/Rol.js";

// El rol tiene que ser uno fijo o uno creado desde Nuevo rol (07/11/2026):
// el modelo ya no trae la lista.
const rolValido = async (rol) =>
  ROLES.includes(rol) || Boolean(await Rol.exists({ rol, personalizado: true }));

export const getAll = async (req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crear = async (req, res) => {
  try {
    if (!(await rolValido(req.body?.rol))) return res.status(400).json({ error: "Ese rol no existe." });
    const nuevo = await Usuario.create(req.body);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    if (req.body?.rol !== undefined && !(await rolValido(req.body.rol))) {
      return res.status(400).json({ error: "Ese rol no existe." });
    }
    const updated = await Usuario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrar = async (req, res) => {
  try {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
