import Colectivo from "../models/Colectivo.js";

export const getAll = async (req, res) => {
  try {
    const colectivos = await Colectivo.find().sort({ gruppo: 1, supervisor: 1, cc: 1 });
    res.json(colectivos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const colectivo = await Colectivo.findById(req.params.id);
    if (!colectivo) return res.status(404).json({ error: "Colectivo no encontrado" });
    res.json(colectivo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const colectivo = new Colectivo(req.body);
    await colectivo.save();
    res.status(201).json(colectivo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const colectivo = await Colectivo.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!colectivo) return res.status(404).json({ error: "Colectivo no encontrado" });
    res.json(colectivo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const colectivo = await Colectivo.findByIdAndDelete(req.params.id);
    if (!colectivo) return res.status(404).json({ error: "Colectivo no encontrado" });
    res.json({ message: "Colectivo eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
