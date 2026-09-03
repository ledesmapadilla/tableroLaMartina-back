import Tractor from "../models/Tractor.js";
import {
  registrarAlta,
  registrarCambios,
  registrarBaja,
} from "./historialtractor.controller.js";
import {
  asegurarCentroCosto,
  sincronizarCentroCosto,
  eliminarCentroCosto,
} from "./centroscosto.controller.js";

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
    await registrarAlta(tractor);
    // Todo tractor que se da de alta pasa a ser tambien un CC de Producción.
    await asegurarCentroCosto({
      cc: tractor.cc,
      equipo: "Tractor",
      descripcion: tractor.descripcion,
      tractor: tractor._id,
    });
    res.status(201).json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    // Se lee el estado previo antes de pisarlo: es lo unico que permite
    // asentar de que valor a que valor se cambio cada campo.
    const anterior = await Tractor.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Tractor no encontrado" });

    const tractor = await Tractor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });

    await registrarCambios(anterior, tractor);
    // El padrón de tractores manda: la edición se refleja en el CC.
    await sincronizarCentroCosto({
      ccAnterior: anterior.cc,
      cc: tractor.cc,
      equipo: "Tractor",
      descripcion: tractor.descripcion,
      tractor: tractor._id,
    });
    res.json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const tractor = await Tractor.findByIdAndDelete(req.params.id);
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    await registrarBaja(tractor);
    await eliminarCentroCosto({ cc: tractor.cc, equipo: "Tractor" });
    res.json({ message: "Tractor eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
