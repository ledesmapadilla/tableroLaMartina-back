import CheckList from "../models/CheckList.js";
import Service from "../models/Service.js";
import Kilometro from "../models/Kilometro.js";
import Camioneta from "../models/Camioneta.js";

const MES_NUM = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

export const getAll = async (req, res) => {
  try {
    const lista = await CheckList.find().populate("camioneta", "marca patente").sort({ createdAt: -1 });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getByCamioneta = async (req, res) => {
  try {
    const lista = await CheckList.find({ camioneta: req.params.camionetaId })
      .populate("camioneta", "marca patente")
      .sort({ createdAt: -1 });
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const item = await CheckList.findById(req.params.id).populate("camioneta", "marca patente");
    if (!item) return res.status(404).json({ error: "Check list no encontrado" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getByMesAño = async (req, res) => {
  try {
    const { camioneta, mes, año } = req.query;
    const item = await CheckList.findOne({ camioneta, mes, año: Number(año) }).populate("camioneta", "marca patente");
    if (!item) return res.status(200).json(null);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sincronizarKilometro = async (body) => {
  if (!body.kms || !body.mes) return;
  const mesNum = MES_NUM[body.mes?.toLowerCase()];
  if (!mesNum) return;
  const anio = body.año || new Date(body.fecha).getFullYear();
  const existente = await Kilometro.findOne({ camioneta: body.camioneta, mes: mesNum, anio });
  if (existente && Number(body.kms) < existente.kms) return;
  await Kilometro.findOneAndUpdate(
    { camioneta: body.camioneta, mes: mesNum, anio },
    { camioneta: body.camioneta, mes: mesNum, anio, fecha: body.fecha, kms: Number(body.kms), responsable: body.encargado },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const sincronizarService = async (body) => {
  if (!body.kmsUltimoService) return;
  const fechaService = body.fechaUltimoService || body.fecha;
  const d = new Date(fechaService);
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fin    = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  await Service.findOneAndUpdate(
    { camioneta: body.camioneta, fecha: { $gte: inicio, $lt: fin } },
    { camioneta: body.camioneta, fecha: fechaService, kms: Number(body.kmsUltimoService), responsable: body.encargado },
    { upsert: true, setDefaultsOnInsert: true }
  );
  // Resetear notificación de service para que vuelva a avisar si vence de nuevo
  await Camioneta.findByIdAndUpdate(body.camioneta, { serviceNotificado: false });
};

export const update = async (req, res) => {
  try {
    const item = await CheckList.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "No encontrado" });
    const ctx = { ...req.body, camioneta: item.camioneta };
    await sincronizarService(ctx);
    await sincronizarKilometro(ctx);
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const checklist = new CheckList(req.body);
    await checklist.save();
    await sincronizarService(req.body);
    await sincronizarKilometro(req.body);
    res.status(201).json(checklist);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const item = await CheckList.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Check list no encontrado" });
    res.json({ message: "Check list eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
