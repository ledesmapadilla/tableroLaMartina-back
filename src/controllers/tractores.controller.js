import Tractor from "../models/Tractor.js";

export const getAll = async (req, res) => {
  try {
    const tractores = await Tractor.find().sort({ gruppo: 1, supervisor: 1, cc: 1 });
    res.json(tractores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const tractor = await Tractor.findById(req.params.id);
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    res.json(tractor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractor = new Tractor(req.body);
    await tractor.save();
    res.status(201).json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const tractor = await Tractor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    res.json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const tractor = await Tractor.findByIdAndDelete(req.params.id);
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    res.json({ message: "Tractor eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
