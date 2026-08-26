import mongoose from "mongoose";
import ServiceColectivo from "../models/ServiceColectivo.js";
import Colectivo from "../models/Colectivo.js";
import KilometroColectivo from "../models/KilometroColectivo.js";

const POPULATE_COLECTIVO = "cc patente descripcion supervisor";

export const getAll = async (req, res) => {
  try {
    const registros = await ServiceColectivo.find()
      .populate("colectivo", POPULATE_COLECTIVO)
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimos = async (req, res) => {
  try {
    const registros = await ServiceColectivo.aggregate([
      { $sort: { colectivo: 1, fecha: -1, createdAt: -1 } },
      { $group: { _id: "$colectivo", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "colectivos",
          localField: "colectivo",
          foreignField: "_id",
          as: "colectivo",
        },
      },
      { $unwind: "$colectivo" },
      { $sort: { "colectivo.cc": 1 } },
    ]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimosPorAño = async (req, res) => {
  try {
    const año = Number(req.params.año);
    const match = {};
    if (!isNaN(año)) {
      match.fecha = { $gte: new Date(año, 0, 1), $lt: new Date(año + 1, 0, 1) };
    }
    const registros = await ServiceColectivo.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $sort: { colectivo: 1, fecha: -1, createdAt: -1 } },
      { $group: { _id: "$colectivo", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "colectivos",
          localField: "colectivo",
          foreignField: "_id",
          as: "colectivo",
        },
      },
      { $unwind: "$colectivo" },
      { $sort: { "colectivo.cc": 1 } },
    ]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Un colectivo puede llegar por _id o por cc: el historial se abre desde la
// tabla (donde hay _id) pero tambien por una referencia suelta al numero de CC.
const buscarColectivo = async (idOCC) => {
  if (mongoose.Types.ObjectId.isValid(idOCC)) {
    const porId = await Colectivo.findById(idOCC);
    if (porId) return porId;
  }
  const clean = String(idOCC || "").replace(/^cc\s*/i, "").trim();
  return Colectivo.findOne({ $or: [{ cc: idOCC }, { cc: clean }, { cc: `CC ${clean}` }] });
};

// Condiciones para juntar todos los registros de un colectivo, aunque el cc
// denormalizado se haya guardado con o sin el prefijo "CC ".
export const condicionesPorColectivo = async (idOCC) => {
  const doc = await buscarColectivo(idOCC);
  const or = [];
  if (mongoose.Types.ObjectId.isValid(idOCC)) or.push({ colectivo: idOCC });
  if (doc?._id) or.push({ colectivo: doc._id });
  if (doc?.cc) {
    const clean = String(doc.cc).replace(/^cc\s*/i, "").trim();
    or.push({ cc: doc.cc }, { cc: clean }, { cc: `CC ${clean}` });
  } else if (idOCC) {
    or.push({ cc: idOCC });
  }
  return or;
};

export const getHistorialPorColectivo = async (req, res) => {
  try {
    const or = await condicionesPorColectivo(req.params.colectivoId);
    const registros = await ServiceColectivo.find(or.length ? { $or: or } : {})
      .populate("colectivo", POPULATE_COLECTIVO)
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kilometraje vigente por CC. A diferencia de los tractores no hay visitas ni
// partes de reparacion de donde inferirlo: sale de los services cargados y de
// las lecturas manuales, y la carga manual manda porque es una confirmacion.
export const calcularUltimosKilometrajes = async ({ incluirManuales = true } = {}) => {
  const mapa = {};

  const registrar = (ccRaw, kmRaw, fechaStr, origen, forzar = false) => {
    if (!ccRaw || kmRaw === null || kmRaw === undefined || kmRaw === "") return;
    const match = String(kmRaw).trim().match(/[\d]+(?:[.,]\d+)?/);
    if (!match) return;
    const num = parseFloat(match[0].replace(",", "."));
    if (isNaN(num)) return;

    const cleanCC = String(ccRaw).replace(/^cc\s*/i, "").trim();
    const entry = { kilometraje: num, fecha: fechaStr, origen };

    const actualizar = (key) => {
      if (!key) return;
      const actual = mapa[key];
      if (!actual) {
        mapa[key] = entry;
        return;
      }

      if (forzar) {
        // Entre cargas manuales gana la mas reciente: llegan ordenadas por
        // fecha descendente, asi que la primera procesada es la buena.
        if (actual.origen === "manual") {
          if (entry.fecha > actual.fecha) mapa[key] = entry;
          return;
        }
        // Frente a una lectura inferida de un service, la carga manual puede
        // corregir incluso hacia abajo si es al menos tan reciente.
        if (entry.fecha >= actual.fecha || num > actual.kilometraje) {
          mapa[key] = entry;
        }
        return;
      }

      // Lectura inferida: el odometro solo avanza. A igual valor queda la mas
      // reciente, para que la fecha mostrada sea la ultima.
      if (num > actual.kilometraje) {
        mapa[key] = entry;
      } else if (num === actual.kilometraje && entry.fecha > actual.fecha) {
        mapa[key] = entry;
      }
    };

    actualizar(cleanCC);
    actualizar(`CC ${cleanCC}`);
    actualizar(String(ccRaw).trim());
  };

  const soloDia = (f) =>
    f ? (typeof f === "string" ? f.split("T")[0] : f.toISOString().split("T")[0]) : "";

  const services = await ServiceColectivo.find().sort({ fecha: -1, createdAt: -1 });
  services.forEach((s) => {
    if (s.cc && typeof s.kilometraje === "number") {
      registrar(s.cc, s.kilometraje, soloDia(s.fecha), "service");
    }
  });

  const manuales = incluirManuales
    ? await KilometroColectivo.find().populate("colectivo", "cc").sort({ fecha: -1, createdAt: -1 })
    : [];

  manuales.forEach((k) => {
    const cc = k.cc || k.colectivo?.cc;
    if (!cc || typeof k.kilometraje !== "number") return;
    const origen = k.origen || "manual";
    registrar(cc, k.kilometraje, soloDia(k.fecha), origen, origen === "manual");
  });

  return mapa;
};

// Mismo mapa que expone el endpoint, reutilizable desde otros controladores.
export const getUltimosKilometrajes = async (req, res) => {
  try {
    res.json(await calcularUltimosKilometrajes());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const colectivoDoc = await Colectivo.findById(req.body.colectivo);
    const data = {
      ...req.body,
      cc: colectivoDoc?.cc || req.body.cc,
      responsable: req.body.responsable || colectivoDoc?.supervisor || "",
      kilometraje: Number(req.body.kilometraje),
      intervalo: Number(req.body.intervalo) || 10000,
    };
    const registro = new ServiceColectivo(data);
    await registro.save();
    const populated = await registro.populate("colectivo", POPULATE_COLECTIVO);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.kilometraje !== undefined) updateData.kilometraje = Number(updateData.kilometraje);
    if (updateData.intervalo !== undefined) updateData.intervalo = Number(updateData.intervalo);
    // Si la edicion cambia el colectivo hay que reescribir el cc denormalizado,
    // que es la clave con la que se arma el mapa de ultimos kilometrajes.
    if (updateData.colectivo) {
      const colectivoDoc = await Colectivo.findById(updateData.colectivo);
      if (colectivoDoc?.cc) updateData.cc = colectivoDoc.cc;
    }
    const registro = await ServiceColectivo.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("colectivo", POPULATE_COLECTIVO);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json(registro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const registro = await ServiceColectivo.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
