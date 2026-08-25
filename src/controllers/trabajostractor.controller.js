import mongoose from "mongoose";
import TrabajoTractor from "../models/TrabajoTractor.js";
import Tractor from "../models/Tractor.js";
import { registrarLecturaDeReparacion } from "./horometrostractor.controller.js";

export const getAll = async (req, res) => {
  try {
    const trabajos = await TrabajoTractor.find()
      .populate("tractor", "cc descripcion supervisor encargadoGral gruppo")
      .sort({ fecha: -1 });
    res.json(trabajos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const ESTADOS_TERMINADOS = ["Terminada", "terminada", "Terminado", "terminado"];

export const getPendientesIds = async (req, res) => {
  try {
    const ids = await TrabajoTractor.distinct("tractor", { estado: { $nin: ESTADOS_TERMINADOS } });
    res.json(ids.map((id) => id.toString()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getById = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findById(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    // Si la edicion agrega o cambia el horometro, tambien va al historial.
    await registrarLecturaDeReparacion(trabajo);
    res.json(trabajo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getPorTractor = async (req, res) => {
  try {
    const trabajos = await TrabajoTractor.find({ tractor: req.params.tractorId }).sort({ fecha: -1 });
    res.json(trabajos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  try {
    let { tractor } = req.body;
    if (tractor && !mongoose.Types.ObjectId.isValid(tractor)) {
      const found = await Tractor.findOne({
        $or: [
          { cc: tractor },
          { cc: `cc ${tractor}` },
          { cc: `CC ${tractor}` },
          { cc: new RegExp(`^${tractor}$`, "i") },
        ],
      });
      if (found) {
        req.body.tractor = found._id;
      }
    }
    const trabajo = await TrabajoTractor.create(req.body);
    // La lectura queda tambien en el historial de horometros del tractor.
    await registrarLecturaDeReparacion(trabajo);
    res.status(201).json(trabajo);
  } catch (e) {
    console.error("Error al crear trabajo tractor:", e);
    res.status(400).json({ error: e.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    // Si la edicion agrega o cambia el horometro, tambien va al historial.
    await registrarLecturaDeReparacion(trabajo);
    res.json(trabajo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findByIdAndDelete(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    // Si la edicion agrega o cambia el horometro, tambien va al historial.
    await registrarLecturaDeReparacion(trabajo);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getParadosIds = async (req, res) => {
  try {
    const ids = await TrabajoTractor.distinct("tractor", {
      estado: { $nin: ESTADOS_TERMINADOS },
      maquinaParada: true,
    });
    res.json(ids.map((id) => id.toString()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
