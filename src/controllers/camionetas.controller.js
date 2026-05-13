import Camioneta from "../models/Camioneta.js";

export const getAll = async (req, res) => {
  try {
    const camionetas = await Camioneta.find().sort({ marca: 1 });
    res.json(camionetas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const camioneta = await Camioneta.findById(req.params.id);
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    res.json(camioneta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const camioneta = new Camioneta(req.body);
    await camioneta.save();
    res.status(201).json(camioneta);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "La patente ya está registrada" });
    }
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const camioneta = await Camioneta.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    res.json(camioneta);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "La patente ya está registrada" });
    }
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const camioneta = await Camioneta.findByIdAndDelete(req.params.id);
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    res.json({ message: "Camioneta eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
