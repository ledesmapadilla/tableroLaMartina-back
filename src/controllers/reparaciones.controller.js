import Reparacion from "../models/Reparacion.js";

export const getAll = async (req, res) => {
  try {
    const reparaciones = await Reparacion.find().sort({ createdAt: -1 });
    res.json(reparaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getByTaller = async (req, res) => {
  try {
    const reparaciones = await Reparacion.find({ taller: req.params.taller }).sort({ createdAt: -1 });
    res.json(reparaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const reparacion = await Reparacion.findById(req.params.id);
    if (!reparacion) return res.status(404).json({ error: "Reparación no encontrada" });
    res.json(reparacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const reparacion = new Reparacion(req.body);
    await reparacion.save();
    res.status(201).json(reparacion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const reparacion = await Reparacion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!reparacion) return res.status(404).json({ error: "Reparación no encontrada" });
    res.json(reparacion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const reparacion = await Reparacion.findByIdAndDelete(req.params.id);
    if (!reparacion) return res.status(404).json({ error: "Reparación no encontrada" });
    res.json({ message: "Reparación eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
