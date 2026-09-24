import mongoose from "mongoose";
import Admisible from "../models/Admisible.js";
import Tarea from "../models/Tarea.js";

// Los valores admisibles van de a uno por tarea: se cargan y se corrigen con
// el mismo PUT (lo crea si no estaba) y se borran con DELETE. La tarea viaja
// en la URL.

const numero = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const datosDe = (body) => ({
  consumo: numero(body.consumo),
  rendimiento: numero(body.rendimiento),
  observaciones: (body.observaciones || "").trim(),
});

const queFalta = (datos) => {
  for (const [campo, rotulo] of [
    ["consumo", "El consumo admisible"],
    ["rendimiento", "El rendimiento"],
  ]) {
    const valor = datos[campo];
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      return `${rotulo} tiene que ser un número de cero para arriba`;
    }
  }
  if (datos.consumo === null && datos.rendimiento === null && !datos.observaciones) {
    return "Cargue al menos un valor";
  }
  return null;
};

// GET / — los valores cargados, con su tarea.
export const getAll = async (req, res) => {
  try {
    const admisibles = await Admisible.find().populate("tarea", "tarea unidad").lean();
    res.json(admisibles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /:tarea — carga o corrige los valores de una tarea.
export const guardar = async (req, res) => {
  try {
    const { tarea } = req.params;
    if (!mongoose.isValidObjectId(tarea) || !(await Tarea.exists({ _id: tarea }))) {
      return res.status(404).json({ error: "La tarea no existe" });
    }
    const datos = datosDe(req.body);
    const falta = queFalta(datos);
    if (falta) return res.status(400).json({ error: falta });

    const admisible = await Admisible.findOneAndUpdate(
      { tarea },
      { ...datos, tarea },
      { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate("tarea", "tarea unidad");
    res.json(admisible);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /:tarea — deja la tarea sin valores admisibles.
export const remove = async (req, res) => {
  try {
    const admisible = await Admisible.findOneAndDelete({ tarea: req.params.tarea });
    if (!admisible) return res.status(404).json({ error: "Esa tarea no tiene valores cargados" });
    res.json({ message: "Valores borrados" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
