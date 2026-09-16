import Camioneta from "../models/Camioneta.js";
import TrabajoCamioneta from "../models/TrabajoCamioneta.js";
import Parada from "../models/Parada.js";
import { sincronizarCentroCosto } from "./centroscosto.controller.js";

// El alta y la baja de una camioneta se hacen en Centros de costo: al crear un
// CC de equipo Camioneta (el código es la patente) aparece acá. Acá solo se
// administra; la patente no se cambia.
//
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

export const update = async (req, res) => {
  try {
    const anterior = await Camioneta.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Camioneta no encontrada" });
    // La patente es el código del CC: no se cambia desde acá.
    if ("patente" in req.body && String(req.body.patente ?? "").trim().toUpperCase() !== anterior.patente) {
      return res.status(400).json({ error: "La patente es el CC de la camioneta: no se cambia desde acá" });
    }

    const camioneta = await Camioneta.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!camioneta) return res.status(404).json({ error: "Camioneta no encontrada" });

    await sincronizarCentroCosto({
      cc: camioneta.patente,
      equipo: "Camioneta",
      descripcion: descripcionCC(camioneta),
    });
    res.json(camioneta);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
