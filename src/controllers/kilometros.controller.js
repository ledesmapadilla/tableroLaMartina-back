import Kilometro from "../models/Kilometro.js";

export const getAll = async (req, res) => {
  try {
    const registros = await Kilometro.find()
      .populate("camioneta", "patente marca responsable")
      .sort({ fecha: -1 })
      .lean();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUltimos = async (req, res) => {
  try {
    const registros = await Kilometro.aggregate([
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

export const getPorAño = async (req, res) => {
  try {
    const año = Number(req.params.año);
    const registros = await Kilometro.find({
      $or: [
        { anio: año },
        { fecha: { $gte: new Date(año, 0, 1), $lt: new Date(año + 1, 0, 1) } },
      ],
    })
      .populate("camioneta", "patente marca responsable")
      .sort({ fecha: -1 })
      .lean();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getResumenPorAño = async (req, res) => {
  try {
    const año = Number(req.params.año);
    const registros = await Kilometro.aggregate([
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

export const update = async (req, res) => {
  try {
    const registro = await Kilometro.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("camioneta", "patente marca");
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json(registro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const registro = await Kilometro.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const registro = new Kilometro(req.body);
    await registro.save();
    const populated = await registro.populate("camioneta", "patente marca");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
