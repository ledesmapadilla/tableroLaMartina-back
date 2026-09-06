import mongoose from "mongoose";
import CambioCertificacion, { CAMPOS } from "../models/CambioCertificacion.js";

const RELACIONES = [
  { path: "persona", select: "apellidoNombre legajo" },
  { path: "tarea", select: "tarea unidad" },
];

const aNumero = (valor) => {
  if (valor === "" || valor === undefined || valor === null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

// Todos los cambios de un mes, del más nuevo al más viejo. Los usa el informe
// para saber qué valor rige y la planilla para mostrar el historial.
export const getDelPeriodo = async (req, res) => {
  try {
    const { anio, mes } = req.params;
    const cambios = await CambioCertificacion.find({ anio: Number(anio), mes: Number(mes) })
      .populate(RELACIONES)
      .sort({ createdAt: -1 });
    res.json(cambios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Registra una corrección de un renglón.
 *
 * No toca los partes: la planilla de carga queda como está y el informe aplica
 * este valor por encima. Por eso cada cambio es un alta y nunca una edición.
 */
export const create = async (req, res) => {
  try {
    const { persona, tarea, cliente, anio, mes, campo, anterior, nuevo, detalle } = req.body;

    if (!mongoose.isValidObjectId(persona)) {
      return res.status(400).json({ error: "Persona inválida" });
    }
    if (!mongoose.isValidObjectId(tarea)) {
      return res.status(400).json({ error: "Tarea inválida" });
    }
    if (!CAMPOS.includes(campo)) {
      return res.status(400).json({ error: "No se puede corregir ese campo desde el informe" });
    }
    if (!(detalle || "").trim()) {
      return res.status(400).json({ error: "Falta el detalle del cambio" });
    }

    const valor = aNumero(nuevo);
    if (valor === null || valor < 0) {
      return res.status(400).json({ error: "El valor nuevo tiene que ser un número válido" });
    }

    const cambio = new CambioCertificacion({
      persona,
      tarea,
      cliente: (cliente || "").trim(),
      anio: Number(anio),
      mes: Number(mes),
      campo,
      anterior: aNumero(anterior),
      nuevo: valor,
      detalle: detalle.trim(),
    });
    await cambio.save();
    res.status(201).json(await cambio.populate(RELACIONES));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Corrige un registro del historial.
 *
 * Solo el valor nuevo y el detalle: el campo, el valor anterior y la fecha son
 * lo que pasó, no se reescriben. Sirve para arreglar un número mal tipeado o
 * un motivo mal redactado sin ensuciar el historial con otro registro.
 */
export const update = async (req, res) => {
  try {
    const cambios = {};

    if ("nuevo" in req.body) {
      const valor = aNumero(req.body.nuevo);
      if (valor === null || valor < 0) {
        return res.status(400).json({ error: "El valor tiene que ser un número válido" });
      }
      cambios.nuevo = valor;
    }

    if ("detalle" in req.body) {
      const detalle = (req.body.detalle || "").trim();
      if (!detalle) return res.status(400).json({ error: "Falta el detalle del cambio" });
      cambios.detalle = detalle;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: "No hay nada que guardar" });
    }

    const cambio = await CambioCertificacion.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    }).populate(RELACIONES);
    if (!cambio) return res.status(404).json({ error: "Cambio no encontrado" });
    res.json(cambio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Deshacer una corrección: se borra el registro y vuelve a regir el valor
// anterior, o el que sale de los partes si no quedaba ninguno.
export const remove = async (req, res) => {
  try {
    const cambio = await CambioCertificacion.findByIdAndDelete(req.params.id);
    if (!cambio) return res.status(404).json({ error: "Cambio no encontrado" });
    res.json({ message: "Cambio eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
