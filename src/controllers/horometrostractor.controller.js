import mongoose from "mongoose";
import HorometroTractor from "../models/HorometroTractor.js";
import Tractor from "../models/Tractor.js";
import { calcularUltimosHorometros } from "./servicestractor.controller.js";

// Los services ya tienen su propia fila en el historial: materializarlos como
// lectura duplicaria el evento. Solo faltan los inferidos de visita/reparacion.
const ORIGENES_A_PERSISTIR = ["visita", "reparacion"];

const ORIGEN_LABEL = {
  visita: "visita",
  service: "service",
  reparacion: "reparación",
};

// Devuelve el numero de horometro de un valor libre ("1519", "1519 hs", "S/H").
export const parsearHorometro = (valor) => {
  if (valor === null || valor === undefined) return null;
  const str = String(valor).trim();
  if (!str || str.toUpperCase() === "S/H") return null;
  const match = str.match(/[\d]+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(",", "."));
  return isNaN(num) ? null : num;
};

// Cada lectura tomada al cargar una reparacion se materializa en el historial.
// Sin esto solo sobrevive la ultima: las anteriores quedan en su trabajo pero
// el historial de preventivo no las lista y se pierden de vista.
export const registrarLecturaDeReparacion = async (trabajo) => {
  const horometro = parsearHorometro(trabajo?.horometro);
  if (horometro === null || !trabajo?.tractor) return null;

  const tractorDoc = await Tractor.findById(trabajo.tractor);
  if (!tractorDoc) return null;

  const fecha = trabajo.fecha ? new Date(trabajo.fecha) : new Date();
  const fechaDia = fecha.toISOString().split("T")[0];

  const yaExiste = await HorometroTractor.findOne({
    tractor: tractorDoc._id,
    horometro,
    fecha: new Date(fechaDia),
  });
  if (yaExiste) return null;

  const detalle = String(trabajo.reparacion || trabajo.descripcion || "").trim();
  return HorometroTractor.create({
    tractor: tractorDoc._id,
    cc: tractorDoc.cc,
    fecha: fechaDia,
    horometro,
    origen: "reparacion",
    observaciones: detalle ? `Reparación: ${detalle.slice(0, 100)}` : "Lectura tomada en reparación",
  });
};

// El +Horom. carga una lectura nueva, pero la anterior puede venir inferida de
// una visita / service / reparacion y no tener registro propio en el historial.
// La persistimos antes de guardar la nueva para que queden las dos.
const persistirLecturaPrevia = async (tractorDoc) => {
  if (!tractorDoc?.cc) return;

  const mapa = await calcularUltimosHorometros();
  const cleanCC = String(tractorDoc.cc).replace(/^cc\s*/i, "").trim();
  const previa = mapa[tractorDoc.cc] || mapa[cleanCC];

  if (!previa || !ORIGENES_A_PERSISTIR.includes(previa.origen)) return;
  if (typeof previa.horometro !== "number" || !previa.fecha) return;

  const yaExiste = await HorometroTractor.findOne({
    tractor: tractorDoc._id,
    horometro: previa.horometro,
    fecha: new Date(previa.fecha),
  });
  if (yaExiste) return;

  await HorometroTractor.create({
    tractor: tractorDoc._id,
    cc: tractorDoc.cc,
    fecha: previa.fecha,
    horometro: previa.horometro,
    origen: previa.origen,
    observaciones: `Lectura anterior (${ORIGEN_LABEL[previa.origen] || previa.origen})`,
  });
};

export const getAll = async (req, res) => {
  try {
    const registros = await HorometroTractor.find()
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorTractor = async (req, res) => {
  try {
    const { tractorId } = req.params;
    const orConditions = [];
    if (mongoose.isValidObjectId(tractorId)) {
      orConditions.push({ tractor: tractorId });
      const tractorDoc = await Tractor.findById(tractorId);
      if (tractorDoc?.cc) orConditions.push({ cc: tractorDoc.cc });
    } else {
      orConditions.push({ cc: tractorId });
    }

    const registros = await HorometroTractor.find(orConditions.length ? { $or: orConditions } : {})
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractorDoc = await Tractor.findById(req.body.tractor);
    await persistirLecturaPrevia(tractorDoc);
    const data = {
      ...req.body,
      cc: tractorDoc?.cc || req.body.cc,
      horometro: Number(req.body.horometro),
    };
    const registro = new HorometroTractor(data);
    await registro.save();
    const populated = await registro.populate("tractor", "cc descripcion supervisor gruppo");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.horometro !== undefined) updateData.horometro = Number(updateData.horometro);
    // El cc denormalizado es la clave del mapa de ultimos horometros: si la
    // edicion mueve la lectura a otro tractor, tiene que seguirlo.
    if (updateData.tractor) {
      const tractorDoc = await Tractor.findById(updateData.tractor);
      if (tractorDoc?.cc) updateData.cc = tractorDoc.cc;
    }
    const registro = await HorometroTractor.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("tractor", "cc descripcion supervisor gruppo");
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json(registro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const registro = await HorometroTractor.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
