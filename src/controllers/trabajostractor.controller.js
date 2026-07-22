import TrabajoTractor from "../models/TrabajoTractor.js";

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

export const getPendientesIds = async (req, res) => {
  try {
    const ids = await TrabajoTractor.distinct("tractor", { estado: { $ne: "terminada" } });
    res.json(ids.map((id) => id.toString()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getById = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findById(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
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
    const trabajo = await TrabajoTractor.create(req.body);
    res.status(201).json(trabajo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    res.json(trabajo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const trabajo = await TrabajoTractor.findByIdAndDelete(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getParadosIds = async (req, res) => {
  try {
    const ids = await TrabajoTractor.distinct("tractor", { estado: { $ne: "Terminado" }, maquinaParada: true });
    res.json(ids.map((id) => id.toString()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
