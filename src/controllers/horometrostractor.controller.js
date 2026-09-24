import mongoose from "mongoose";
import HorometroTractor from "../models/HorometroTractor.js";
import Tractor from "../models/Tractor.js";
import CentroCosto from "../models/CentroCosto.js";
import { calcularUltimosHorometros } from "./servicestractor.controller.js";
import {
  parsearHorometro as parsear,
  validarLectura,
  registrarCambio,
  corregirLectura,
  cambiosDeTractor,
  horometroVigente,
  horasAcumuladas,
  lecturasDeVisitas,
} from "../services/horometros.service.js";

// Los services ya tienen su propia fila en el historial: materializarlos como
// lectura duplicaria el evento. Solo faltan los inferidos de visita/reparacion.
const ORIGENES_A_PERSISTIR = ["visita", "reparacion"];

const ORIGEN_LABEL = {
  visita: "visita",
  service: "service",
  reparacion: "reparación",
  produccion: "parte diario",
};

// Se mantiene el nombre exportado: lo usan otros controllers.
export const parsearHorometro = parsear;

// ── Endpoints de la regla del horómetro ──────────────────────────────

// Lo consultan las pantallas ANTES de guardar, para poder mostrar el aviso con
// las tres alternativas sin haber escrito nada todavía.
export const validar = async (req, res) => {
  try {
    const { tractor, fecha, horometro, ignorarId } = req.body;
    if (!mongoose.isValidObjectId(tractor)) {
      return res.status(400).json({ error: "Tractor inválido" });
    }
    res.json(await validarLectura({ tractor, fecha, horometro, ignorarId }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registra el reemplazo físico del horómetro (opción 3 del aviso).
export const crearCambio = async (req, res) => {
  try {
    const { tractor, fecha, horasAnterior, lecturaInicial, observaciones } = req.body;
    if (!mongoose.isValidObjectId(tractor)) {
      return res.status(400).json({ error: "Tractor inválido" });
    }
    const cambio = await registrarCambio({
      tractor,
      fecha,
      horasAnterior,
      lecturaInicial,
      observaciones,
    });
    res.status(201).json(cambio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Corrige la última lectura registrada cuando la que estaba mal era esa y no
// la nueva (opción 4 del aviso). La pantalla reintenta el guardado después.
export const corregir = async (req, res) => {
  try {
    const { tractor, fecha, valorAnterior, valorNuevo } = req.body;
    if (!mongoose.isValidObjectId(tractor)) {
      return res.status(400).json({ error: "Tractor inválido" });
    }
    const resultado = await corregirLectura({ tractor, fecha, valorAnterior, valorNuevo });
    // El valor corregido también retrocede respecto de una lectura anterior.
    if (!resultado.ok) return res.status(409).json(resultado);
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Historial de cambios de un tractor, para mostrar de qué horómetro se trata.
export const getCambios = async (req, res) => {
  try {
    const { tractorId } = req.params;
    if (!mongoose.isValidObjectId(tractorId)) {
      return res.status(400).json({ error: "Tractor inválido" });
    }
    const cambios = await cambiosDeTractor(tractorId);
    const vigente = await horometroVigente(tractorId, new Date());
    res.json({ cambios, vigente });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Horas reales de la máquina (acumuladas de todos sus horómetros).
export const getHorasAcumuladas = async (req, res) => {
  try {
    const { tractorId } = req.params;
    const { lectura, fecha } = req.query;
    if (!mongoose.isValidObjectId(tractorId)) {
      return res.status(400).json({ error: "Tractor inválido" });
    }
    const horas = await horasAcumuladas(tractorId, lectura, fecha);
    const vigente = await horometroVigente(tractorId, fecha || new Date());
    res.json({ horas, ...vigente });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Con qué lectura queda la máquina al terminar el parte: la salida, y si
// todavía no está cargada, la entrada. Es una sola por parte para no llenar el
// historial con dos filas del mismo día.
const lecturaDelParte = (parte) => {
  const salida = parsearHorometro(parte?.horomSalida);
  if (salida !== null) return { horometro: salida, campo: "salida" };
  return { horometro: parsearHorometro(parte?.horomIngreso), campo: "entrada" };
};

// El horómetro que se carga en un parte de Producción es el del tractor: se
// materializa en el historial para que el preventivo cuente las horas reales
// de trabajo y no dependa de que alguien pase de visita.
export const registrarLecturaDeParte = async (parte, { centro = null, nuevo = false } = {}) => {
  if (!parte?._id) return null;

  // Cada parte deja como mucho una lectura: al editarlo se rehace, así no
  // quedan colgadas las versiones anteriores del horómetro. Un parte recién
  // creado no tiene nada que limpiar.
  if (!nuevo) await HorometroTractor.deleteMany({ parte: parte._id });

  // Se toma la salida: es la lectura con la que la máquina termina el día. Si
  // todavía no está cargada vale la entrada (22/09/2026): antes un parte con
  // solo la entrada no dejaba nada y el preventivo no se enteraba de que la
  // máquina había trabajado.
  const { horometro, campo } = lecturaDelParte(parte);
  if (horometro === null || !parte?.cc) return null;

  // El CC de Producción solo es un tractor si tiene el enlace cargado. El que
  // llama puede pasarlo ya leído para no volver a pedirlo.
  const centroDoc = centro || (await CentroCosto.findById(parte.cc).populate("tractor", "cc"));
  const tractorDoc = centroDoc?.tractor;
  if (!tractorDoc) return null;

  const fecha = parte.fecha ? new Date(parte.fecha) : new Date();
  const fechaDia = fecha.toISOString().split("T")[0];

  // Si otra fuente ya anotó esa misma lectura ese día, no se duplica.
  const yaExiste = await HorometroTractor.findOne({
    tractor: tractorDoc._id,
    horometro,
    fecha: new Date(fechaDia),
  });
  if (yaExiste) return null;

  return HorometroTractor.create({
    tractor: tractorDoc._id,
    cc: tractorDoc.cc,
    fecha: fechaDia,
    horometro,
    origen: "produccion",
    parte: parte._id,
    observaciones: `Lectura de ${campo} del parte diario de Producción`,
  });
};

/**
 * Deshace la lectura que dejó un parte. Al borrar la fila de certificaciones
 * el horómetro tiene que volver a ser el que era antes de cargarla.
 */
export const borrarLecturaDeParte = async (parte) => {
  if (!parte?._id) return 0;

  const { deletedCount } = await HorometroTractor.deleteMany({ parte: parte._id });
  if (deletedCount) return deletedCount;

  // Partes cargados antes de que la lectura guardara el enlace: se ubica por
  // el dato, acotado al origen "produccion" para no tocar otras fuentes.
  const { horometro } = lecturaDelParte(parte);
  if (horometro === null || !parte.cc) return 0;

  const centro = await CentroCosto.findById(parte.cc).select("tractor").lean();
  if (!centro?.tractor) return 0;

  const fechaDia = new Date(parte.fecha || Date.now()).toISOString().split("T")[0];
  const r = await HorometroTractor.deleteMany({
    tractor: centro.tractor,
    horometro,
    fecha: new Date(fechaDia),
    origen: "produccion",
  });
  return r.deletedCount;
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
    let tractorDoc = null;
    if (mongoose.isValidObjectId(tractorId)) {
      orConditions.push({ tractor: tractorId });
      tractorDoc = await Tractor.findById(tractorId).lean();
      if (tractorDoc?.cc) orConditions.push({ cc: tractorDoc.cc });
    } else {
      orConditions.push({ cc: tractorId });
    }

    const registros = await HorometroTractor.find(orConditions.length ? { $or: orConditions } : {})
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 })
      .lean();
    // lean() no aplica los defaults del esquema: las lecturas viejas, cargadas
    // antes de que existiera `origen`, son cargas manuales.
    registros.forEach((r) => {
      r.origen = r.origen || "manual";
    });

    // Las visitas no tienen fila propia en el historial (solo se copian cuando
    // una carga manual las tapa): sin esto, apenas una lectura más nueva la
    // reemplaza en la tabla, la de la visita no se ve en ningún lado. Van de
    // solo lectura porque se editan desde Visitas. Las ya copiadas no se
    // repiten.
    if (tractorDoc) {
      const dia = (f) => new Date(f).toISOString().split("T")[0];
      const listadas = new Set(registros.map((r) => `${dia(r.fecha)}|${r.horometro}`));
      const { _id, cc, descripcion, supervisor, gruppo } = tractorDoc;
      for (const l of await lecturasDeVisitas(tractorDoc)) {
        const clave = `${l.fecha}|${l.horometro}`;
        if (listadas.has(clave)) continue;
        listadas.add(clave);
        registros.push({
          _id: l.id,
          tractor: { _id, cc, descripcion, supervisor, gruppo },
          cc,
          fecha: new Date(`${l.fecha}T00:00:00.000Z`),
          horometro: l.horometro,
          origen: "visita",
          observaciones: l.observaciones || `Visita${l.grupo ? ` (${l.grupo})` : ""}`,
          soloLectura: true,
        });
      }
      // sort es estable: a igual fecha se mantiene el orden por createdAt.
      registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractorDoc = await Tractor.findById(req.body.tractor);

    const chequeo = await validarLectura({
      tractor: req.body.tractor,
      fecha: req.body.fecha,
      horometro: req.body.horometro,
    });
    if (!chequeo.ok) return res.status(409).json(chequeo);

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
    const previo = await HorometroTractor.findById(req.params.id).select("tractor").lean();
    const chequeo = await validarLectura({
      tractor: req.body.tractor || previo?.tractor,
      fecha: req.body.fecha,
      horometro: req.body.horometro,
      ignorarId: req.params.id,
    });
    if (!chequeo.ok) return res.status(409).json(chequeo);

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
