import TrabajoCamioneta from "../models/TrabajoCamioneta.js";

export const getAll = async (req, res) => {
  try {
    const trabajos = await TrabajoCamioneta.find()
      .populate("camioneta", "patente marca responsable")
      .sort({ fecha: -1 })
      .lean();
    res.json(trabajos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getPendientesIds = async (req, res) => {
  try {
    const trabajos = await TrabajoCamioneta.find({
      estado: { $in: ["Pendiente", "pendiente", "En proceso", "en proceso", "En Proceso"] },
    })
      .select("camioneta")
      .lean();

    const setIds = new Set(trabajos.map((t) => t.camioneta?.toString()).filter(Boolean));
    res.json(Array.from(setIds));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getById = async (req, res) => {
  try {
    const trabajo = await TrabajoCamioneta.findById(req.params.id).lean();
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    res.json(trabajo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getPorCamioneta = async (req, res) => {
  try {
    const trabajos = await TrabajoCamioneta.find({ camioneta: req.params.camionetaId })
      .sort({ fecha: -1, createdAt: -1, _id: -1 })
      .lean();
    res.json(trabajos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  try {
    const trabajo = await TrabajoCamioneta.create(req.body);
    res.status(201).json(trabajo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const trabajo = await TrabajoCamioneta.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    res.json(trabajo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const trabajo = await TrabajoCamioneta.findByIdAndDelete(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
