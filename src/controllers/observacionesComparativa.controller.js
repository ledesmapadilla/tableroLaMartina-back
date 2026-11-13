import mongoose from "mongoose";
import ObservacionComparativa from "../models/ObservacionComparativa.js";

/**
 * Observaciones de las filas de la solapa Comparativa (12/11/2026). Cualquiera
 * con sesión las lee y escribe: no piden permiso de Contable.
 */

const TIPOS = ["cantidad", "costos"];

/** { anio, mes, campo, tipo } válidos de la ruta, o null. */
const delMes = (p) => {
  const anio = Number(p.anio);
  const mes = Number(p.mes);
  const campo = String(p.campo || "").trim();
  const tipo = String(p.tipo || "").trim();
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return null;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  if (!campo || !TIPOS.includes(tipo)) return null;
  return { anio, mes, campo, tipo };
};

const esNacho = (u) => u?.rol === "superadmin" && u?.usuario === "nacho";

/** GET /api/contable/observaciones/:anio/:mes/:campo/:tipo → [{ clave, tarea, notas }] */
export const getObservaciones = async (req, res) => {
  const filtro = delMes(req.params);
  if (!filtro) return res.status(400).json({ error: "Mes, campo o comparativa inválidos." });
  try {
    const lista = await ObservacionComparativa.find(filtro).select("clave tarea notas").lean();
    res.json(lista.filter((o) => o.notas?.length));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** POST /api/contable/observaciones/:anio/:mes/:campo/:tipo  { clave, tarea, texto } → la fila con sus notas */
export const postObservacion = async (req, res) => {
  const filtro = delMes(req.params);
  if (!filtro) return res.status(400).json({ error: "Mes, campo o comparativa inválidos." });
  const clave = String(req.body?.clave || "").trim();
  const tarea = String(req.body?.tarea || "").trim();
  const texto = String(req.body?.texto || "").trim();
  if (!clave) return res.status(400).json({ error: "Falta la fila." });
  if (!texto) return res.status(400).json({ error: "La observación está vacía." });
  if (texto.length > 1000) return res.status(400).json({ error: "La observación no puede pasar de 1000 caracteres." });
  try {
    const doc = await ObservacionComparativa.findOneAndUpdate(
      { ...filtro, clave },
      {
        $set: { tarea },
        $push: { notas: { texto, usuario: req.usuario?.usuario, nombre: req.usuario?.nombre, fecha: new Date() } },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();
    res.status(201).json({ clave: doc.clave, tarea: doc.tarea, notas: doc.notas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** DELETE /api/contable/observaciones/nota/:id: la borra quien la escribió (o Nacho). */
export const deleteNota = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Observación inválida." });
  try {
    const doc = await ObservacionComparativa.findOne({ "notas._id": id }).select("notas").lean();
    const nota = doc?.notas.find((n) => String(n._id) === id);
    if (!nota) return res.status(404).json({ error: "La observación no existe." });
    if (nota.usuario !== req.usuario?.usuario && !esNacho(req.usuario)) {
      return res.status(403).json({ error: "Solo la puede borrar quien la escribió." });
    }
    await ObservacionComparativa.updateOne({ _id: doc._id }, { $pull: { notas: { _id: id } } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
