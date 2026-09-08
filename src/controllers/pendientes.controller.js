import Pendiente from "../models/Pendiente.js";

// Los más nuevos arriba: es el orden en que se repasan en la reunión.
export const getAll = async (req, res) => {
  try {
    const filtro = {};
    if (req.query.sector) filtro.sector = req.query.sector;
    if (req.query.responsable) filtro.responsable = req.query.responsable;
    const pendientes = await Pendiente.find(filtro).sort({ fecha: -1, createdAt: -1 });
    res.json(pendientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const pendiente = await Pendiente.findById(req.params.id);
    if (!pendiente) return res.status(404).json({ error: "Pendiente no encontrado" });
    res.json(pendiente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const pendiente = new Pendiente(req.body);
    await pendiente.save();
    res.status(201).json(pendiente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const pendiente = await Pendiente.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!pendiente) return res.status(404).json({ error: "Pendiente no encontrado" });
    res.json(pendiente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const pendiente = await Pendiente.findByIdAndDelete(req.params.id);
    if (!pendiente) return res.status(404).json({ error: "Pendiente no encontrado" });
    res.json({ message: "Pendiente eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
