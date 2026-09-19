import Visita from "../models/Visita.js";
import { validarVisita } from "../services/horometros.service.js";

const VENTANA_DOBLE_ENVIO_MS = 15 * 1000;

export const listar = async (req, res) => {
  try {
    const filtro = {};
    if (req.query.fecha) filtro.fecha = req.query.fecha;
    const visitas = await Visita.find(filtro).sort({ fecha: 1, createdAt: 1 });
    res.json(visitas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  try {
    // La visita puede anotar el horómetro de varios tractores a la vez.
    const chequeo = await validarVisita({
      cc: req.body.cc,
      horometro: req.body.horometro,
      fecha: req.body.fecha,
    });
    if (!chequeo.ok) return res.status(409).json(chequeo);

    // Un doble envío llega con la misma visita a segundos de distancia: se
    // devuelve la ya guardada en vez de crear otra.
    const { fecha, grupo, cc = "", horometro = "", observaciones = "" } = req.body;
    const repetida = await Visita.findOne({
      fecha,
      grupo: String(grupo ?? "").trim(),
      cc: String(cc).trim(),
      horometro: String(horometro).trim(),
      observaciones: String(observaciones).trim(),
      createdAt: { $gte: new Date(Date.now() - VENTANA_DOBLE_ENVIO_MS) },
    });
    if (repetida) return res.status(201).json(repetida);

    const visita = await Visita.create(req.body);
    res.status(201).json(visita);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// Saca un tractor de una visita con varios. El horómetro de una visita con
// varios CC se guarda como "160: 405 hs, 1104: S/H": se quita el par de ese CC.
export const quitarCC = async (req, res) => {
  try {
    const visita = await Visita.findById(req.params.id);
    if (!visita) return res.status(404).json({ error: "No encontrada" });

    const quitar = String(req.body.cc ?? "").trim();
    const ccs = visita.cc.split(",").map((s) => s.trim()).filter(Boolean);
    const quedan = ccs.filter((c) => c !== quitar);
    if (quedan.length === ccs.length) {
      return res.status(404).json({ error: `La visita no tiene el CC ${quitar}` });
    }
    if (quedan.length === 0) {
      return res.status(400).json({ error: "Es el único tractor de la visita: elimine la visita" });
    }

    let horometro = visita.horometro;
    if (horometro.includes(":")) {
      const pares = horometro
        .split(",")
        .map((s) => s.trim())
        .filter((p) => p && p.split(":")[0].trim() !== quitar);
      // Con un solo CC la visita guarda el valor solo, sin "CC:" ni "hs".
      horometro =
        quedan.length === 1 && pares.length === 1
          ? pares[0].split(":").slice(1).join(":").replace(/\s*hs$/i, "").trim()
          : pares.join(", ");
    }

    visita.cc = quedan.join(", ");
    visita.horometro = horometro;
    await visita.save();
    res.json(visita);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const visita = await Visita.findByIdAndDelete(req.params.id);
    if (!visita) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
