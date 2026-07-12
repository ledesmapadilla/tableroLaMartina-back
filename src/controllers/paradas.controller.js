import Parada from "../models/Parada.js";

export const getAbiertasCount = async (req, res) => {
  try {
    const count = await Parada.countDocuments({ $or: [{ fechaArranque: null }, { fechaArranque: { $exists: false } }] });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getPorCamioneta = async (req, res) => {
  try {
    const paradas = await Parada.find({ camioneta: req.params.camionetaId }).sort({ fechaParada: -1 });
    res.json(paradas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  try {
    const parada = await Parada.create(req.body);
    res.status(201).json(parada);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const parada = await Parada.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!parada) return res.status(404).json({ error: "No encontrada" });
    res.json(parada);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const parada = await Parada.findByIdAndDelete(req.params.id);
    if (!parada) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getAbiertasIds = async (req, res) => {
  try {
    const paradas = await Parada.find({ $or: [{ fechaArranque: null }, { fechaArranque: { $exists: false } }] }, "camioneta");
    const ids = paradas.map((p) => p.camioneta ? p.camioneta.toString() : "");
    res.json(ids.filter(Boolean));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
