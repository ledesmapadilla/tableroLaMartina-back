import mongoose from "mongoose";
import CajaMovimiento, { CONCEPTOS_CAJA } from "../models/CajaMovimiento.js";

/**
 * Contable › Caja (13/11/2026, segunda versión): los movimientos de la caja,
 * ingresos y gastos, en una sola tabla. Todo pide el permiso contable.caja:
 * leer, "Ver"; escribir, "Editar" (contable.routes.js).
 */

const MAX_ARCHIVOS = 10;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const fechaValida = (s) => {
  if (!FECHA.test(String(s || ""))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const responderError = (res, error) => {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ error: Object.values(error.errors || {})[0]?.message || "Datos inválidos." });
  }
  return res.status(500).json({ error: error.message });
};

/** Lo que manda la pantalla, revisado: { datos } o { error }. */
const datosDe = (body) => {
  const fecha = String(body?.fecha || "");
  if (!fechaValida(fecha)) return { error: "Falta la fecha." };
  const concepto = String(body?.concepto || "");
  if (!CONCEPTOS_CAJA.includes(concepto)) return { error: "El concepto es ingreso o gasto." };
  const monto = Math.round(Number(String(body?.monto ?? "").replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto tiene que ser mayor que cero." };
  const descripcion = String(body?.descripcion || "").trim().slice(0, 300);
  if (!descripcion) return { error: "Falta la descripción." };
  const archivos = Array.isArray(body?.archivos) ? body.archivos : [];
  if (archivos.length > MAX_ARCHIVOS) return { error: `Hasta ${MAX_ARCHIVOS} adjuntos por movimiento.` };
  if (archivos.some((a) => !a || typeof a.url !== "string" || !/^https:\/\//.test(a.url))) {
    return { error: "Algún adjunto no es válido." };
  }
  return {
    datos: {
      fecha,
      concepto,
      monto,
      descripcion,
      observaciones: String(body?.observaciones || "").trim().slice(0, 1000),
      archivos: archivos.map((a) => ({
        url: a.url,
        nombre: String(a.nombre || "").slice(0, 200),
        publicId: String(a.publicId || ""),
        tipo: a.tipo === "raw" ? "raw" : "image",
      })),
    },
  };
};

/** GET /api/contable/caja: todos los movimientos, los más nuevos primero. */
export const getMovimientos = async (req, res) => {
  try {
    res.json(await CajaMovimiento.find().sort({ fecha: -1, createdAt: -1 }).lean());
  } catch (error) {
    responderError(res, error);
  }
};

/** POST /api/contable/caja */
export const postMovimiento = async (req, res) => {
  const { datos, error } = datosDe(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const nuevo = await CajaMovimiento.create({ ...datos, cargadoPor: req.usuario?.usuario || "" });
    res.status(201).json(nuevo);
  } catch (err) {
    responderError(res, err);
  }
};

/** PUT /api/contable/caja/:id */
export const putMovimiento = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Id inválido." });
  const { datos, error } = datosDe(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const mov = await CajaMovimiento.findByIdAndUpdate(req.params.id, { $set: datos }, { returnDocument: "after", runValidators: true });
    if (!mov) return res.status(404).json({ error: "Ya no existe: puede que lo haya borrado otro." });
    res.json(mov);
  } catch (err) {
    responderError(res, err);
  }
};

/**
 * DELETE /api/contable/caja/:id
 * Los adjuntos de Cloudinary los borra la pantalla (services/archivos.js).
 */
export const deleteMovimiento = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Id inválido." });
  try {
    const mov = await CajaMovimiento.findByIdAndDelete(req.params.id);
    if (!mov) return res.status(404).json({ error: "Ya no existe: puede que lo haya borrado otro." });
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err);
  }
};
