import Service from "../models/Service.js";
import Camioneta from "../models/Camioneta.js";

export const getAll = async (req, res) => {
  try {
    const registros = await Service.find()
      .populate("camioneta", "patente marca")
      .sort({ fecha: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimos = async (req, res) => {
  try {
    const registros = await Service.aggregate([
      { $sort: { fecha: -1, createdAt: -1 } },
      { $group: { _id: "$camioneta", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "camionetas",
          localField: "camioneta",
          foreignField: "_id",
          as: "camioneta",
        },
      },
      { $unwind: "$camioneta" },
      { $sort: { "camioneta.patente": 1 } },
    ]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimosPorAño = async (req, res) => {
  try {
    const año = Number(req.params.año);
    const registros = await Service.aggregate([
      { $match: { fecha: { $gte: new Date(año, 0, 1), $lt: new Date(año + 1, 0, 1) } } },
      { $sort: { fecha: -1, createdAt: -1 } },
      { $group: { _id: "$camioneta", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $lookup: { from: "camionetas", localField: "camioneta", foreignField: "_id", as: "camioneta" } },
      { $unwind: "$camioneta" },
      { $sort: { "camioneta.patente": 1 } },
    ]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getResumenPorAño = async (req, res) => {
  try {
    const año = Number(req.params.año);
    const registros = await Service.aggregate([
      { $match: { fecha: { $gte: new Date(año, 0, 1), $lt: new Date(año + 1, 0, 1) } } },
      { $group: { _id: { mes: { $month: "$fecha" }, camioneta: "$camioneta" } } },
      { $group: { _id: "$_id.mes", camionetas: { $push: "$_id.camioneta" } } },
    ]);
    const resumen = {};
    registros.forEach((r) => { resumen[r._id] = r.camionetas.map((id) => id.toString()); });
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const registro = new Service(req.body);
    await registro.save();
    // Al registrar un service, resetear la notificación para que vuelva a avisar la próxima vez
    if (req.body.camioneta) {
      await Camioneta.findByIdAndUpdate(req.body.camioneta, { serviceNotificado: false });
    }
    const populated = await registro.populate("camioneta", "patente marca");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
