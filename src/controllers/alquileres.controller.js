import mongoose from "mongoose";
import Alquiler from "../models/Alquiler.js";
import PrecioAlquiler from "../models/PrecioAlquiler.js";
import EquivalenciaCostos from "../models/EquivalenciaCostos.js";
import { claveTarea as clave } from "../catalogos/claveTarea.js";
import { nombresCitrusvil } from "./equivalencias.controller.js";

/**
 * Los alquileres de Contable (12/11/2026): el nombre lo pone el usuario, el
 * monto mensual va con fecha e historial (preciosContable.controller.js).
 */

const limpiar = (t) => String(t || "").trim().replace(/\s+/g, " ");

/** Un nombre que no esté ya (sin contar mayúsculas, acentos ni signos). → error o null */
const nombreRepetido = async (nombre, salvo = null) => {
  const todos = await Alquiler.find(salvo ? { _id: { $ne: salvo } } : {}).select("nombre").lean();
  const ya = todos.find((a) => clave(a.nombre) === clave(nombre));
  return ya ? `Ya existe el alquiler «${ya.nombre}».` : null;
};

const validar = (nombre) => {
  if (!nombre) return "Falta el nombre.";
  if (nombre.length > 80) return "El nombre no puede pasar de 80 caracteres.";
  if (!clave(nombre)) return "El nombre tiene que tener letras o números.";
  return null;
};

/** GET /api/contable/alquileres → [{ _id, nombre, precios: [{ fecha, precio }] }] */
export const getAlquileres = async (req, res) => {
  try {
    const [alquileres, precios] = await Promise.all([
      Alquiler.find().sort({ nombre: 1 }).select("nombre").lean(),
      PrecioAlquiler.find().sort({ fecha: -1 }).select("alquiler fecha precio").lean(),
    ]);
    res.json(
      alquileres.map((a) => ({
        ...a,
        // Todos sus montos, del más nuevo al más viejo: la comparativa elige
        // el vigente al cierre del mes.
        precios: precios.filter((p) => String(p.alquiler) === String(a._id)).map(({ fecha, precio }) => ({ fecha, precio })),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** POST /api/contable/alquileres { nombre } */
export const postAlquiler = async (req, res) => {
  const nombre = limpiar(req.body?.nombre);
  const error = validar(nombre);
  if (error) return res.status(400).json({ error });
  try {
    const repetido = await nombreRepetido(nombre);
    if (repetido) return res.status(400).json({ error: repetido });
    const doc = await Alquiler.create({ nombre, creadoPor: req.usuario?.usuario });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** PUT /api/contable/alquileres/:id { nombre } — le cambia el nombre. */
export const putAlquiler = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Alquiler inválido." });
  const nombre = limpiar(req.body?.nombre);
  const error = validar(nombre);
  if (error) return res.status(400).json({ error });
  try {
    const repetido = await nombreRepetido(nombre, id);
    if (repetido) return res.status(400).json({ error: repetido });
    const doc = await Alquiler.findByIdAndUpdate(id, { $set: { nombre } }, { returnDocument: "after" }).lean();
    if (!doc) return res.status(404).json({ error: "El alquiler no existe." });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/contable/alquileres/:id — con sus montos. No se deja si alguna
 * tarea de Citrusvil va con él en costos: primero hay que sacarla.
 */
export const deleteAlquiler = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Alquiler inválido." });
  try {
    const usado = await EquivalenciaCostos.findOne({ $or: [{ alquiler: id }, { alquileres: id }] }).select("nombre").lean();
    if (usado) {
      return res
        .status(409)
        .json({ error: `«${usado.nombre}» va con este alquiler en costos: primero hay que sacarlo (Ctv → LM, lápiz).` });
    }
    const r = await Alquiler.deleteOne({ _id: id });
    if (!r.deletedCount) return res.status(404).json({ error: "El alquiler no existe." });
    await PrecioAlquiler.deleteMany({ alquiler: id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/alquileres/:id/citrusvil { nombres: [texto] }
 *
 * La fila del alquiler en Equivalencias › LM → Ctv (12/11/2026), como la de
 * MotoGenerador-Personal: esas tareas de Citrusvil van también con el
 * alquiler en la Comparativa de costos (se suma a lo que ya tuvieran) y las
 * que iban con él y no están, lo pierden. Una que queda sin nada vuelve a la
 * de siempre.
 */
export const putCitrusvilAlquiler = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Alquiler inválido." });
  if (!Array.isArray(req.body?.nombres)) return res.status(400).json({ error: "Faltan las tareas de Citrusvil." });
  try {
    if (!(await Alquiler.exists({ _id: id }))) return res.status(404).json({ error: "El alquiler no existe." });
    // Con el nombre que manda para cada clave, como en las equivalencias.
    const mandan = await nombresCitrusvil();
    const porClave = new Map();
    for (const n of req.body.nombres.map(limpiar).filter(Boolean)) {
      const k = clave(n);
      if (k && !porClave.has(k)) porClave.set(k, mandan.get(k) || n);
    }
    const nombres = [...porClave.values()];
    const alquiler = new mongoose.Types.ObjectId(id);
    const vacia = {
      $and: [
        { $or: [{ tareas: { $exists: false } }, { tareas: { $size: 0 } }] },
        { $or: [{ alquileres: { $exists: false } }, { alquileres: { $size: 0 } }] },
        { $or: [{ alquiler: null }, { alquiler: { $exists: false } }] },
      ],
    };
    await EquivalenciaCostos.bulkWrite(
      [
        // Las que lo tenían y ya no: se les saca (también el viejo suelto).
        {
          updateMany: {
            filter: { nombre: { $nin: nombres }, alquileres: alquiler },
            update: { $pull: { alquileres: alquiler } },
          },
        },
        {
          updateMany: {
            filter: { nombre: { $nin: nombres }, alquiler },
            update: { $set: { alquiler: null } },
          },
        },
        // Las tildadas: se les suma.
        ...nombres.map((nombre) => ({
          updateOne: { filter: { nombre }, update: { $addToSet: { alquileres: alquiler } }, upsert: true },
        })),
        { deleteMany: { filter: vacia } },
      ],
      { ordered: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
