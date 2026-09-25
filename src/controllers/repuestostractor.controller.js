import mongoose from "mongoose";
import RepuestoTractor from "../models/RepuestoTractor.js";
import Tractor from "../models/Tractor.js";

const FILTROS = ["filtroAire", "filtroCombustible", "filtroTrampaAgua", "filtroAceite"];
const MARCAS_POR_FILTRO = 3;

// Las alternativas de un filtro, prolijas: hasta 3 y sin las que quedaron
// vacías.
const limpiarAlternativas = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map((a) => ({ marca: String(a?.marca ?? "").trim(), codigo: String(a?.codigo ?? "").trim() }))
    .filter((a) => a.marca || a.codigo)
    .slice(0, MARCAS_POR_FILTRO);

export const getAll = async (req, res) => {
  try {
    res.json(await RepuestoTractor.find().lean());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Guarda los filtros de un tractor. La primera vez crea su ficha de repuestos.
export const guardar = async (req, res) => {
  try {
    const { tractorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tractorId) || !(await Tractor.exists({ _id: tractorId }))) {
      return res.status(404).json({ error: "Tractor no encontrado" });
    }

    const cambios = {};
    for (const filtro of FILTROS) {
      if (filtro in req.body) cambios[filtro] = limpiarAlternativas(req.body[filtro]);
    }
    if ("observaciones" in req.body) cambios.observaciones = String(req.body.observaciones ?? "").trim();
    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: "No llegó nada para guardar" });
    }

    const repuesto = await RepuestoTractor.findOneAndUpdate(
      { tractor: tractorId },
      { $set: cambios },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(repuesto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
