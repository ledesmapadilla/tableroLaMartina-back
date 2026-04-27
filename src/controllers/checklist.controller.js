import CheckList from "../models/CheckList.js";

export const getAll = async (req, res) => {
  try {
    const lista = await CheckList.find().populate("camioneta", "marca patente").sort({ createdAt: -1 });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getByCamioneta = async (req, res) => {
  try {
    const lista = await CheckList.find({ camioneta: req.params.camionetaId })
      .populate("camioneta", "marca patente")
      .sort({ createdAt: -1 });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const item = await CheckList.findById(req.params.id).populate("camioneta", "marca patente");
    if (!item) return res.status(404).json({ error: "Check list no encontrado" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getByMesAño = async (req, res) => {
  try {
    const { camioneta, mes, año } = req.query;
    const item = await CheckList.findOne({ camioneta, mes, año: Number(año) }).populate("camioneta", "marca patente");
    if (!item) return res.status(404).json({ error: "No encontrado" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const item = await CheckList.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "No encontrado" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const checklist = new CheckList(req.body);
    await checklist.save();
    res.status(201).json(checklist);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const item = await CheckList.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Check list no encontrado" });
    res.json({ message: "Check list eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
