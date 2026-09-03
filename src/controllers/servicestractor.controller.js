import mongoose from "mongoose";
import ServiceTractor from "../models/ServiceTractor.js";
import Tractor from "../models/Tractor.js";
import Visita from "../models/Visita.js";
import TrabajoTractor from "../models/TrabajoTractor.js";
import HorometroTractor from "../models/HorometroTractor.js";
import {
  validarLectura,
  mapaDeCambios,
  acumularConCambios,
} from "../services/horometros.service.js";

// Le suma a cada service las horas acumuladas de los horómetros anteriores.
// El preventivo tiene que comparar acumuladas contra acumuladas.
const conAcumuladas = async (registros) => {
  const cambios = await mapaDeCambios();
  if (!cambios.size) {
    return registros.map((r) => ({ ...r, acumuladas: r.horometro, numeroHorometro: 1 }));
  }
  return registros.map((r) => {
    const id = String(r.tractor?._id || r.tractor || "");
    const { acumuladas, numero } = acumularConCambios(cambios.get(id) || [], r.horometro, r.fecha);
    return { ...r, acumuladas, numeroHorometro: numero };
  });
};

export const getAll = async (req, res) => {
  try {
    const registros = await ServiceTractor.find()
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimos = async (req, res) => {
  try {
    const registros = await ServiceTractor.aggregate([
      { $sort: { tractor: 1, fecha: -1, createdAt: -1 } },
      { $group: { _id: "$tractor", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "tractors",
          localField: "tractor",
          foreignField: "_id",
          as: "tractor",
        },
      },
      { $unwind: "$tractor" },
      { $sort: { "tractor.cc": 1 } },
    ]);
    res.json(await conAcumuladas(registros));
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
    const registros = await ServiceTractor.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $sort: { tractor: 1, fecha: -1, createdAt: -1 } },
      { $group: { _id: "$tractor", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "tractors",
          localField: "tractor",
          foreignField: "_id",
          as: "tractor",
        },
      },
      { $unwind: "$tractor" },
      { $sort: { "tractor.cc": 1 } },
    ]);
    res.json(await conAcumuladas(registros));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorTractor = async (req, res) => {
  try {
    const { tractorId } = req.params;
    let tractorDoc = null;
    if (mongoose.Types.ObjectId.isValid(tractorId)) {
      tractorDoc = await Tractor.findById(tractorId);
    }
    if (!tractorDoc) {
      tractorDoc = await Tractor.findOne({
        $or: [
          { cc: tractorId },
          { cc: String(tractorId).replace(/^cc\s*/i, "").trim() },
          { cc: `CC ${String(tractorId).replace(/^cc\s*/i, "").trim()}` },
        ],
      });
    }

    const orConditions = [];
    if (mongoose.Types.ObjectId.isValid(tractorId)) {
      orConditions.push({ tractor: tractorId });
    }
    if (tractorDoc?._id) {
      orConditions.push({ tractor: tractorDoc._id });
    }
    if (tractorDoc?.cc) {
      const clean = String(tractorDoc.cc).replace(/^cc\s*/i, "").trim();
      orConditions.push({ cc: tractorDoc.cc });
      orConditions.push({ cc: clean });
      orConditions.push({ cc: `CC ${clean}` });
    } else if (tractorId) {
      orConditions.push({ cc: tractorId });
    }

    const registros = await ServiceTractor.find(orConditions.length ? { $or: orConditions } : {})
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 })
      .lean();
    res.json(await conAcumuladas(registros));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// incluirManuales:false devuelve el horometro que estaba vigente antes de
// cualquier carga manual (lo que la pantalla mostraba como "Horometro actual").
export const calcularUltimosHorometros = async ({ incluirManuales = true } = {}) => {
    const visitas = await Visita.find({
      horometro: { $exists: true, $ne: "" },
    }).sort({ fecha: -1, createdAt: -1 });

    const horometrosMap = {};

    const registrarHorometro = (ccRaw, horoRaw, fechaStr, origen, forzar = false) => {
      if (!ccRaw || !horoRaw) return;
      const strHoro = String(horoRaw).trim();
      if (strHoro.toUpperCase() === "S/H") return;

      const matchNum = strHoro.match(/[\d]+(?:[.,]\d+)?/);
      if (!matchNum) return;
      const num = parseFloat(matchNum[0].replace(",", "."));
      if (isNaN(num)) return;

      const cleanCC = String(ccRaw).replace(/^cc\s*/i, "").trim();
      const fullCC = `CC ${cleanCC}`;
      const entry = { horometro: num, fecha: fechaStr, origen };

      const actualizar = (key) => {
        if (!key) return;
        const actual = horometrosMap[key];
        if (!actual) {
          horometrosMap[key] = entry;
          return;
        }

        if (forzar) {
          // Entre cargas manuales gana la mas reciente. Llegan ordenadas por
          // fecha descendente, asi que la primera en procesarse es la buena.
          if (actual.origen === "manual") {
            if (entry.fecha > actual.fecha) horometrosMap[key] = entry;
            return;
          }
          // Frente a una lectura inferida, la carga manual es una confirmacion
          // explicita y puede corregir incluso hacia abajo, siempre que sea al
          // menos tan reciente como la lectura que reemplaza.
          if (entry.fecha >= actual.fecha || num > actual.horometro) {
            horometrosMap[key] = entry;
          }
          return;
        }

        // Lectura inferida: el horometro solo avanza. A igual valor se queda la
        // mas reciente, para que la fecha que se muestra sea la ultima.
        if (num > actual.horometro) {
          horometrosMap[key] = entry;
        } else if (num === actual.horometro && entry.fecha > actual.fecha) {
          horometrosMap[key] = entry;
        }
      };

      actualizar(cleanCC);
      actualizar(fullCC);
      actualizar(String(ccRaw).trim());
    };

    visitas.forEach((v) => {
      if (!v.cc || !v.horometro) return;
      const fechaStr = v.fecha ? (typeof v.fecha === "string" ? v.fecha.split("T")[0] : v.fecha.toISOString().split("T")[0]) : "";

      const horometroStr = String(v.horometro).trim();
      const ccStr = String(v.cc).trim();

      if (horometroStr.includes(":") || ccStr.includes(",")) {
        const ccs = ccStr.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

        ccs.forEach((c) => {
          const cleanC = c.replace(/^cc\s*/i, "").trim();
          const regexConDosPuntos = new RegExp(`(?:CC\\s*)?${cleanC}\\s*:\\s*([^,;]+)`, "i");
          const match = horometroStr.match(regexConDosPuntos);

          if (match) {
            const hVal = match[1].replace(/\s*hs/i, "").trim();
            registrarHorometro(c, hVal, fechaStr, "visita");
          } else {
            const partesHoro = horometroStr.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
            if (partesHoro.length === ccs.length) {
              const idx = ccs.indexOf(c);
              if (idx !== -1) {
                registrarHorometro(c, partesHoro[idx], fechaStr, "visita");
              }
            }
          }
        });

        // Capturar cualquier otro tractor especificado en el string
        const todosConDosPuntos = horometroStr.matchAll(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi);
        for (const m of todosConDosPuntos) {
          const foundCC = m[1];
          const foundVal = m[2].replace(/\s*hs/i, "").trim();
          registrarHorometro(foundCC, foundVal, fechaStr, "visita");
        }
      } else {
        registrarHorometro(v.cc, v.horometro, fechaStr, "visita");
      }
    });

    const services = await ServiceTractor.find().sort({ fecha: -1, createdAt: -1 });
    services.forEach((s) => {
      if (s.cc && typeof s.horometro === "number") {
        const fechaStr = s.fecha ? (typeof s.fecha === "string" ? s.fecha.split("T")[0] : s.fecha.toISOString().split("T")[0]) : "";
        registrarHorometro(s.cc, s.horometro, fechaStr, "service");
      }
    });

    const trabajos = await TrabajoTractor.find({
      horometro: { $exists: true, $ne: "" },
    })
      .populate("tractor", "cc")
      .sort({ fecha: -1, createdAt: -1 });

    trabajos.forEach((t) => {
      const cc = t.tractor?.cc || t.cc;
      if (cc && t.horometro && String(t.horometro).toUpperCase() !== "S/H") {
        const fechaStr = t.fecha ? (typeof t.fecha === "string" ? t.fecha.split("T")[0] : t.fecha.toISOString().split("T")[0]) : "";
        registrarHorometro(cc, t.horometro, fechaStr, "reparacion");
      }
    });

    const manuales = incluirManuales
      ? await HorometroTractor.find()
          .populate("tractor", "cc")
          .sort({ fecha: -1, createdAt: -1 })
      : [];

    manuales.forEach((h) => {
      const cc = h.cc || h.tractor?.cc;
      if (!cc || typeof h.horometro !== "number") return;
      const fechaStr = h.fecha ? (typeof h.fecha === "string" ? h.fecha.split("T")[0] : h.fecha.toISOString().split("T")[0]) : "";
      const origen = h.origen || "manual";
      // Solo una lectura cargada a mano es autoritativa: las materializadas
      // desde visitas/reparaciones compiten con su origen real.
      registrarHorometro(cc, h.horometro, fechaStr, origen, origen === "manual");
    });

  // Horas reales de cada tractor. Mientras no haya cambios de horómetro
  // cargados, `acumuladas` es igual al horómetro y `numero` es 1: el
  // preventivo se comporta exactamente como antes.
  const cambiosPorTractor = await mapaDeCambios();
  if (cambiosPorTractor.size) {
    const tractores = await Tractor.find().select("cc").lean();
    const porCC = new Map();
    for (const t of tractores) {
      const clean = String(t.cc || "").replace(/^cc\s*/i, "").trim();
      const cambios = cambiosPorTractor.get(String(t._id)) || [];
      porCC.set(clean, cambios);
      porCC.set(`CC ${clean}`, cambios);
      porCC.set(String(t.cc || "").trim(), cambios);
    }
    for (const [clave, entry] of Object.entries(horometrosMap)) {
      const { acumuladas, numero } = acumularConCambios(
        porCC.get(clave) || [],
        entry.horometro,
        entry.fecha
      );
      entry.acumuladas = acumuladas;
      entry.numeroHorometro = numero;
    }
  } else {
    for (const entry of Object.values(horometrosMap)) {
      entry.acumuladas = entry.horometro;
      entry.numeroHorometro = 1;
    }
  }

  return horometrosMap;
};

// Mismo mapa que expone el endpoint, reutilizable desde otros controladores.
export const getUltimosHorometros = async (req, res) => {
  try {
    res.json(await calcularUltimosHorometros());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractorDoc = await Tractor.findById(req.body.tractor);

    // Regla del horómetro: la pantalla resuelve el conflicto y reintenta.
    const chequeo = await validarLectura({
      tractor: req.body.tractor,
      fecha: req.body.fecha,
      horometro: req.body.horometro,
    });
    if (!chequeo.ok) return res.status(409).json(chequeo);

    const data = {
      ...req.body,
      cc: tractorDoc?.cc || req.body.cc,
      responsable: req.body.responsable || tractorDoc?.supervisor || "",
      horometro: Number(req.body.horometro),
      intervalo: Number(req.body.intervalo) || 250,
    };
    const registro = new ServiceTractor(data);
    await registro.save();
    const populated = await registro.populate("tractor", "cc descripcion supervisor gruppo");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    // Al editar, el propio registro no cuenta como lectura anterior.
    const previo = await ServiceTractor.findById(req.params.id).select("tractor").lean();
    const chequeo = await validarLectura({
      tractor: req.body.tractor || previo?.tractor,
      fecha: req.body.fecha,
      horometro: req.body.horometro,
      ignorarId: req.params.id,
    });
    if (!chequeo.ok) return res.status(409).json(chequeo);

    const updateData = { ...req.body };
    if (updateData.horometro !== undefined) updateData.horometro = Number(updateData.horometro);
    if (updateData.intervalo !== undefined) updateData.intervalo = Number(updateData.intervalo);
    // Si la edicion cambia el tractor hay que reescribir el cc denormalizado,
    // que es la clave con la que se arma el mapa de ultimos horometros.
    if (updateData.tractor) {
      const tractorDoc = await Tractor.findById(updateData.tractor);
      if (tractorDoc?.cc) updateData.cc = tractorDoc.cc;
    }
    const registro = await ServiceTractor.findByIdAndUpdate(req.params.id, updateData, {
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
    const registro = await ServiceTractor.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
