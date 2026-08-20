import ServiceTractor from "../models/ServiceTractor.js";
import Tractor from "../models/Tractor.js";
import Visita from "../models/Visita.js";
import TrabajoTractor from "../models/TrabajoTractor.js";

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
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorTractor = async (req, res) => {
  try {
    const { tractorId } = req.params;
    const registros = await ServiceTractor.find({ tractor: tractorId })
      .populate("tractor", "cc descripcion supervisor gruppo")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimosHorometros = async (req, res) => {
  try {
    const visitas = await Visita.find({
      horometro: { $exists: true, $ne: "" },
    }).sort({ fecha: -1, createdAt: -1 });

    const horometrosMap = {};

    visitas.forEach((v) => {
      if (v.cc && v.horometro && v.horometro.toUpperCase() !== "S/H") {
        const cleanCC = String(v.cc).replace(/^cc\s*/i, "").trim();
        const num = parseFloat(v.horometro);
        if (!isNaN(num)) {
          const fechaStr = v.fecha ? String(v.fecha).split("T")[0] : "";
          const entry = { horometro: num, fecha: fechaStr, origen: "visita" };

          if (!horometrosMap[cleanCC] || horometrosMap[cleanCC].horometro < num) {
            horometrosMap[cleanCC] = entry;
          }
          if (!horometrosMap[v.cc] || horometrosMap[v.cc].horometro < num) {
            horometrosMap[v.cc] = entry;
          }
        }
      }
    });

    const services = await ServiceTractor.find().sort({ fecha: -1, createdAt: -1 });
    services.forEach((s) => {
      if (s.cc && typeof s.horometro === "number") {
        const cleanCC = String(s.cc).replace(/^cc\s*/i, "").trim();
        const fechaStr = s.fecha ? (typeof s.fecha === "string" ? s.fecha.split("T")[0] : s.fecha.toISOString().split("T")[0]) : "";
        const entry = { horometro: s.horometro, fecha: fechaStr, origen: "service" };

        if (!horometrosMap[cleanCC] || horometrosMap[cleanCC].horometro < s.horometro) {
          horometrosMap[cleanCC] = entry;
        }
        if (!horometrosMap[s.cc] || horometrosMap[s.cc].horometro < s.horometro) {
          horometrosMap[s.cc] = entry;
        }
      }
    });

    const trabajos = await TrabajoTractor.find({
      horometro: { $exists: true, $ne: "" },
    })
      .populate("tractor", "cc")
      .sort({ fecha: -1, createdAt: -1 });

    trabajos.forEach((t) => {
      const cc = t.tractor?.cc || t.cc;
      if (cc && t.horometro) {
        const cleanCC = String(cc).replace(/^cc\s*/i, "").trim();
        const num = parseFloat(t.horometro);
        if (!isNaN(num)) {
          const fechaStr = t.fecha ? (typeof t.fecha === "string" ? t.fecha.split("T")[0] : t.fecha.toISOString().split("T")[0]) : "";
          const entry = { horometro: num, fecha: fechaStr, origen: "reparacion" };

          if (!horometrosMap[cleanCC] || horometrosMap[cleanCC].horometro < num) {
            horometrosMap[cleanCC] = entry;
          }
          if (!horometrosMap[cc] || horometrosMap[cc].horometro < num) {
            horometrosMap[cc] = entry;
          }
        }
      }
    });

    res.json(horometrosMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractorDoc = await Tractor.findById(req.body.tractor);
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
    const updateData = { ...req.body };
    if (updateData.horometro !== undefined) updateData.horometro = Number(updateData.horometro);
    if (updateData.intervalo !== undefined) updateData.intervalo = Number(updateData.intervalo);
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
