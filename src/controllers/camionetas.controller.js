import Camioneta from "../models/Camioneta.js";
import TrabajoCamioneta from "../models/TrabajoCamioneta.js";
import Parada from "../models/Parada.js";
import {
  asegurarCentroCosto,
  sincronizarCentroCosto,
  eliminarCentroCosto,
} from "./centroscosto.controller.js";

// En el listado de CC la camioneta se identifica por su patente, y la
// descripción se arma con la marca y el modelo.
const descripcionCC = (c) => [c.marca, c.modelo].filter(Boolean).join(" ").trim();

export const getAll = async (req, res) => {
  try {
    const camionetas = await Camioneta.find().sort({ marca: 1 }).lean();
    res.json(camionetas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const camioneta = await Camioneta.findById(req.params.id).lean();
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    res.json(camioneta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const camioneta = new Camioneta(req.body);
    await camioneta.save();
    // Toda camioneta que se da de alta pasa a ser también un CC de Producción.
    await asegurarCentroCosto({
      cc: camioneta.patente,
      equipo: "Camioneta",
      descripcion: descripcionCC(camioneta),
    });
    res.status(201).json(camioneta);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "La patente ya está registrada" });
    }
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    // Se lee la patente previa antes de pisarla: es la que identifica al CC.
    const anterior = await Camioneta.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Camioneta no encontrada" });

    const camioneta = await Camioneta.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });

    await sincronizarCentroCosto({
      ccAnterior: anterior.patente,
      cc: camioneta.patente,
      equipo: "Camioneta",
      descripcion: descripcionCC(camioneta),
    });
    res.json(camioneta);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "La patente ya está registrada" });
    }
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const camioneta = await Camioneta.findByIdAndDelete(req.params.id);
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    await eliminarCentroCosto({ cc: camioneta.patente, equipo: "Camioneta" });
    res.json({ message: "Camioneta eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pantalla de reparaciones (listado). Antes el front pedia camionetas,
// pendientes y paradas por separado: tres invocaciones concurrentes, cada una
// con su propio arranque en frio y su propia conexion a Mongo.
export const getResumenReparaciones = async (req, res) => {
  try {
    const [camionetas, trabajos, paradas] = await Promise.all([
      Camioneta.find().sort({ marca: 1 }).lean(),
      TrabajoCamioneta.find({
        $or: [
          { estado: { $in: ["Pendiente", "pendiente", "En proceso", "en proceso", "En Proceso"] } },
          { maquinaParada: true, estado: { $nin: ["Terminada", "terminada", "Terminado"] } },
        ],
      })
        .select("camioneta estado maquinaParada")
        .lean(),
      Parada.find({ $or: [{ fechaArranque: null }, { fechaArranque: { $exists: false } }] })
        .select("camioneta")
        .lean(),
    ]);

    const pendientes = new Set();
    const detenidas = new Set();

    for (const t of trabajos) {
      const id = t.camioneta?.toString();
      if (!id) continue;
      const estado = (t.estado || "").toLowerCase();
      if (estado === "pendiente" || estado === "en proceso") pendientes.add(id);
      if (t.maquinaParada && !estado.startsWith("terminad")) detenidas.add(id);
    }
    for (const p of paradas) {
      const id = p.camioneta?.toString();
      if (id) detenidas.add(id);
    }

    res.json({
      camionetas,
      pendientes: Array.from(pendientes),
      paradas: Array.from(detenidas),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Detalle de reparaciones de una camioneta, en una sola invocacion.
export const getDetalleReparaciones = async (req, res) => {
  try {
    const { id } = req.params;
    const [camioneta, trabajos, paradas] = await Promise.all([
      Camioneta.findById(id).lean(),
      TrabajoCamioneta.find({ camioneta: id }).sort({ fecha: -1, createdAt: -1, _id: -1 }).lean(),
      Parada.find({ camioneta: id }).sort({ fechaParada: -1 }).lean(),
    ]);

    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });
    res.json({ camioneta, trabajos, paradas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
