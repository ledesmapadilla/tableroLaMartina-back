import Parada from "../models/Parada.js";
import Camioneta from "../models/Camioneta.js";

export const getAbiertasCount = async (req, res) => {
  try {
    const [paradas, camionetas] = await Promise.all([
      Parada.find({ $or: [{ fechaArranque: null }, { fechaArranque: { $exists: false } }] }, "camioneta"),
      Camioneta.find({}, "_id"),
    ]);

    const camionetasIds = new Set(camionetas.map((c) => c._id.toString()));
    const unidadesParadas = new Set(
      paradas
        .map((p) => p.camioneta?.toString())
        .filter((id) => id && camionetasIds.has(id))
    );

    res.json({ count: unidadesParadas.size });
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
    const [paradas, camionetas] = await Promise.all([
      Parada.find({ $or: [{ fechaArranque: null }, { fechaArranque: { $exists: false } }] }, "camioneta"),
      Camioneta.find({}, "_id"),
    ]);

    const camionetasIds = new Set(camionetas.map((c) => c._id.toString()));
    const ids = Array.from(
      new Set(
        paradas
          .map((p) => p.camioneta?.toString())
          .filter((id) => id && camionetasIds.has(id))
      )
    );
    res.json(ids);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
