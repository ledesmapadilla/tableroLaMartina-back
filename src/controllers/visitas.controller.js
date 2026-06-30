import Visita from "../models/Visita.js";

export const listar = async (req, res) => {
  try {
    const filtro = {};
    if (req.query.fecha) filtro.fecha = req.query.fecha;
    const visitas = await Visita.find(filtro).sort({ fecha: 1, createdAt: 1 });
    res.json(visitas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  try {
    const visita = await Visita.create(req.body);
    res.status(201).json(visita);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const visita = await Visita.findByIdAndDelete(req.params.id);
    if (!visita) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
