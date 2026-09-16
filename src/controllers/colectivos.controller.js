import Colectivo from "../models/Colectivo.js";
import { sincronizarCentroCosto } from "./centroscosto.controller.js";

// El alta y la baja de un colectivo se hacen en Centros de costo: al crear un
// CC de equipo Colectivo aparece acá. Acá solo se administra (supervisor,
// descripción); el CC, que es la patente, no se cambia.

export const getAll = async (req, res) => {
  try {
    const colectivos = await Colectivo.find().sort({ supervisor: 1, cc: 1 });
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

export const update = async (req, res) => {
  try {
    const anterior = await Colectivo.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Colectivo no encontrado" });
    if ("cc" in req.body && String(req.body.cc ?? "").trim().toUpperCase() !== anterior.cc) {
      return res.status(400).json({ error: "El CC del colectivo no se cambia desde acá" });
    }

    const colectivo = await Colectivo.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await sincronizarCentroCosto({ cc: colectivo.cc, equipo: "Colectivo", descripcion: colectivo.descripcion });
    res.json(colectivo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
