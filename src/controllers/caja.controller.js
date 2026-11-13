import mongoose from "mongoose";
import CajaSemana from "../models/CajaSemana.js";
import { cuentaDeSemana, esInicio, fechaValida, finDeSemana, inicioDe, semanasDelMes, semanasDelAnio } from "../catalogos/caja.js";

/**
 * Contable › Caja (13/11/2026): el control de caja por semana (viernes a
 * jueves). Todo pide el permiso contable.caja: leer, "Ver"; escribir,
 * "Editar" (contable.routes.js).
 */

const LISTAS = { entradas: "entradas", gastos: "gastos" };
const MAX_ARCHIVOS = 10;

const errorDeValidacion = (error) =>
  error?.name === "ValidationError" || error?.name === "CastError"
    ? Object.values(error.errors || {})[0]?.message || "Datos inválidos."
    : null;

const responderError = (res, error) => {
  const mensaje = errorDeValidacion(error);
  if (mensaje) return res.status(400).json({ error: mensaje });
  return res.status(500).json({ error: error.message });
};

/** El viernes de la URL (inicio de la semana), o la respuesta 400 si no lo es. */
const inicioDeLaRuta = (req, res) => {
  const { inicio } = req.params;
  if (!esInicio(inicio)) {
    res.status(400).json({ error: "La semana tiene que empezar un viernes (AAAA-MM-DD)." });
    return null;
  }
  return inicio;
};

/** La semana con su cuenta, como la lee la pantalla. */
const semanaCompleta = async (inicio) => {
  const docs = await CajaSemana.find({ semana: { $lte: inicio } }).lean();
  const actual = docs.find((d) => d.semana === inicio);
  const ordenar = (l) => [...(l || [])].sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a._id).localeCompare(String(b._id)));
  return {
    semana: inicio,
    hasta: finDeSemana(inicio),
    ...cuentaDeSemana(docs, inicio),
    lista: { entradas: ordenar(actual?.entradas), gastos: ordenar(actual?.gastos) },
  };
};

/** GET /api/contable/caja/semana/:inicio */
export const getSemana = async (req, res) => {
  const inicio = inicioDeLaRuta(req, res);
  if (!inicio) return;
  try {
    res.json(await semanaCompleta(inicio));
  } catch (error) {
    responderError(res, error);
  }
};

/**
 * GET /api/contable/caja/mes/:anio/:mes  (mes de 1 a 12)
 * Una fila por semana cuyo viernes cae en ese mes, con su cuenta y cuántos
 * movimientos tiene: las tarjetas de la página del mes.
 */
export const getMes = async (req, res) => {
  const anio = Number(req.params.anio);
  const mes = Number(req.params.mes);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: "Mes inválido." });
  }
  const semanas = semanasDelMes(anio, mes);
  if (!semanas.length) return res.json([]);
  try {
    const docs = await CajaSemana.find({ semana: { $lte: semanas[semanas.length - 1] } }).lean();
    const porSemana = new Map(docs.map((d) => [d.semana, d]));
    res.json(
      semanas.map((j) => ({
        semana: j,
        hasta: finDeSemana(j),
        ...cuentaDeSemana(docs, j),
        movimientos: (porSemana.get(j)?.entradas?.length || 0) + (porSemana.get(j)?.gastos?.length || 0),
      }))
    );
  } catch (error) {
    responderError(res, error);
  }
};

/**
 * GET /api/contable/caja/anio/:anio
 * El acumulado del año (13/11/2026): todas las semanas cuyo viernes cae en
 * ese año, con su cuenta. La pantalla las agrupa por mes.
 */
export const getAnio = async (req, res) => {
  const anio = Number(req.params.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return res.status(400).json({ error: "Año inválido." });
  const semanas = semanasDelAnio(anio);
  try {
    const docs = await CajaSemana.find({ semana: { $lte: semanas[semanas.length - 1] } }).lean();
    res.json(semanas.map((s) => ({ semana: s, hasta: finDeSemana(s), ...cuentaDeSemana(docs, s) })));
  } catch (error) {
    responderError(res, error);
  }
};

/**
 * PUT /api/contable/caja/semana/:inicio/fijo  { fijo }
 * El ingreso fijo desde esta semana en adelante. null lo vuelve al de la
 * semana anterior.
 */
export const putFijo = async (req, res) => {
  const inicio = inicioDeLaRuta(req, res);
  if (!inicio) return;
  const crudo = req.body?.fijo;
  const fijo = crudo === null || crudo === "" ? null : Number(crudo);
  if (fijo !== null && (!Number.isFinite(fijo) || fijo < 0)) {
    return res.status(400).json({ error: "El ingreso fijo tiene que ser un número mayor o igual a cero." });
  }
  try {
    await CajaSemana.updateOne({ semana: inicio }, { $set: { fijo } }, { upsert: true, runValidators: true });
    res.json(await semanaCompleta(inicio));
  } catch (error) {
    responderError(res, error);
  }
};

/** Lo que manda la pantalla para una entrada o un gasto, revisado. */
const datosDe = (body, lista, inicio) => {
  const fecha = String(body?.fecha || "");
  if (!fechaValida(fecha)) return { error: "Falta la fecha." };
  if (inicioDe(fecha) !== inicio) {
    return { error: `La fecha tiene que estar dentro de la semana (viernes ${inicio} a jueves ${finDeSemana(inicio)}).` };
  }
  const monto = Math.round(Number(String(body?.monto ?? "").replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto tiene que ser mayor que cero." };
  const datos = { fecha, monto, descripcion: String(body?.descripcion || "").trim().slice(0, 300) };
  if (lista === "gastos") {
    const archivos = Array.isArray(body?.archivos) ? body.archivos : [];
    if (archivos.length > MAX_ARCHIVOS) return { error: `Hasta ${MAX_ARCHIVOS} archivos por gasto.` };
    if (archivos.some((a) => !a || typeof a.url !== "string" || !/^https:\/\//.test(a.url))) {
      return { error: "Algún archivo no es válido." };
    }
    datos.archivos = archivos.map((a) => ({
      url: a.url,
      nombre: String(a.nombre || "").slice(0, 200),
      publicId: String(a.publicId || ""),
      tipo: a.tipo === "raw" ? "raw" : "image",
    }));
  }
  return { datos };
};

const listaDeLaRuta = (req, res) => {
  const lista = LISTAS[req.params.lista];
  if (!lista) res.status(404).json({ error: "No existe." });
  return lista;
};

/** POST /api/contable/caja/semana/:inicio/:lista  (entradas | gastos) */
export const postMovimiento = async (req, res) => {
  const inicio = inicioDeLaRuta(req, res);
  if (!inicio) return;
  const lista = listaDeLaRuta(req, res);
  if (!lista) return;
  const { datos, error } = datosDe(req.body, lista, inicio);
  if (error) return res.status(400).json({ error });
  try {
    const nuevo = { ...datos, cargadoPor: req.usuario?.usuario || "" };
    await CajaSemana.updateOne({ semana: inicio }, { $push: { [lista]: nuevo } }, { upsert: true, runValidators: true });
    res.status(201).json(await semanaCompleta(inicio));
  } catch (err) {
    responderError(res, err);
  }
};

/** PUT /api/contable/caja/semana/:inicio/:lista/:id */
export const putMovimiento = async (req, res) => {
  const inicio = inicioDeLaRuta(req, res);
  if (!inicio) return;
  const lista = listaDeLaRuta(req, res);
  if (!lista) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Id inválido." });
  const { datos, error } = datosDe(req.body, lista, inicio);
  if (error) return res.status(400).json({ error });
  try {
    const set = Object.fromEntries(Object.entries(datos).map(([k, v]) => [`${lista}.$.${k}`, v]));
    set[`${lista}.$.updatedAt`] = new Date();
    const r = await CajaSemana.updateOne(
      { semana: inicio, [`${lista}._id`]: req.params.id },
      { $set: set },
      { runValidators: true }
    );
    if (!r.matchedCount) return res.status(404).json({ error: "Ya no existe: puede que lo haya borrado otro." });
    res.json(await semanaCompleta(inicio));
  } catch (err) {
    responderError(res, err);
  }
};

/**
 * DELETE /api/contable/caja/semana/:inicio/:lista/:id
 * Los archivos de Cloudinary los borra la pantalla (services/archivos.js).
 */
export const deleteMovimiento = async (req, res) => {
  const inicio = inicioDeLaRuta(req, res);
  if (!inicio) return;
  const lista = listaDeLaRuta(req, res);
  if (!lista) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Id inválido." });
  try {
    const r = await CajaSemana.updateOne(
      { semana: inicio, [`${lista}._id`]: req.params.id },
      { $pull: { [lista]: { _id: req.params.id } } }
    );
    if (!r.matchedCount) return res.status(404).json({ error: "Ya no existe: puede que lo haya borrado otro." });
    res.json(await semanaCompleta(inicio));
  } catch (err) {
    responderError(res, err);
  }
};
