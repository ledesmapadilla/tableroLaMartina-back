import KilometroColectivo from "../models/KilometroColectivo.js";
import Colectivo from "../models/Colectivo.js";
import { condicionesPorColectivo } from "./servicescolectivo.controller.js";

const POPULATE_COLECTIVO = "cc patente descripcion supervisor";

export const getAll = async (req, res) => {
  try {
    const registros = await KilometroColectivo.find()
      .populate("colectivo", POPULATE_COLECTIVO)
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorColectivo = async (req, res) => {
  try {
    const or = await condicionesPorColectivo(req.params.colectivoId);
    const registros = await KilometroColectivo.find(or.length ? { $or: or } : {})
      .populate("colectivo", POPULATE_COLECTIVO)
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const colectivoDoc = await Colectivo.findById(req.body.colectivo);
    const data = {
      ...req.body,
      cc: colectivoDoc?.cc || req.body.cc,
      kilometraje: Number(req.body.kilometraje),
    };
    const registro = new KilometroColectivo(data);
    await registro.save();
    const populated = await registro.populate("colectivo", POPULATE_COLECTIVO);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.kilometraje !== undefined) updateData.kilometraje = Number(updateData.kilometraje);
    // El cc denormalizado es la clave del mapa de ultimos kilometrajes: si la
    // edicion mueve la lectura a otro colectivo, tiene que seguirlo.
    if (updateData.colectivo) {
      const colectivoDoc = await Colectivo.findById(updateData.colectivo);
      if (colectivoDoc?.cc) updateData.cc = colectivoDoc.cc;
    }
    const registro = await KilometroColectivo.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("colectivo", POPULATE_COLECTIVO);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json(registro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const registro = await KilometroColectivo.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
