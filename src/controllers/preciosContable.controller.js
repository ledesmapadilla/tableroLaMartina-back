import mongoose from "mongoose";
import PrecioGasoil from "../models/PrecioGasoil.js";
import PrecioDolar from "../models/PrecioDolar.js";
import PrecioAlquiler from "../models/PrecioAlquiler.js";

/**
 * Precios con fecha de Contable (07/11/2026): el del gasoil y el del dólar, y
 * desde el 12/11/2026 el monto de cada alquiler. Todos se manejan igual, cada
 * uno en su colección: uno por fecha, rige el más nuevo.
 *
 * `alcance(req)` (los alquileres) dice de cuál son los precios: se suma a
 * cada búsqueda. Si devuelve null, la ruta es inválida.
 */

// "2026-11-07" → 07/11/2026 00:00 UTC. Cualquier otra cosa → null.
const aFecha = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCDate() === +m[3] ? d : null;
};

const controladores = (Modelo, alcance = () => ({})) => ({
  /** GET — todos los precios, del más nuevo al más viejo. */
  getAll: async (req, res) => {
    const a = alcance(req);
    if (!a) return res.status(400).json({ error: "Ruta inválida." });
    try {
      res.json(await Modelo.find(a).sort({ fecha: -1 }).lean());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /** PUT { fecha: "AAAA-MM-DD", precio } — si ya había uno esa fecha, lo pisa. */
  put: async (req, res) => {
    const a = alcance(req);
    if (!a) return res.status(400).json({ error: "Ruta inválida." });
    const fecha = aFecha(req.body?.fecha);
    const precio = Number(req.body?.precio);
    if (!fecha) return res.status(400).json({ error: "Falta la fecha." });
    if (!Number.isFinite(precio) || precio <= 0)
      return res.status(400).json({ error: "El precio tiene que ser mayor que 0." });
    try {
      const doc = await Modelo.findOneAndUpdate(
        { ...a, fecha },
        { $set: { precio, cargadoPor: req.usuario?.usuario } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      ).lean();
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /:id { fecha: "AAAA-MM-DD", precio } — corrige uno del historial
   * (07/11/2026). No puede quedar en la fecha de otro: uno por fecha.
   */
  update: async (req, res) => {
    const a = alcance(req);
    if (!a) return res.status(400).json({ error: "Ruta inválida." });
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Precio inválido." });
    const fecha = aFecha(req.body?.fecha);
    const precio = Number(req.body?.precio);
    if (!fecha) return res.status(400).json({ error: "Falta la fecha." });
    if (!Number.isFinite(precio) || precio <= 0)
      return res.status(400).json({ error: "El precio tiene que ser mayor que 0." });
    try {
      const otro = await Modelo.exists({ ...a, fecha, _id: { $ne: id } });
      if (otro) return res.status(409).json({ error: "Ya hay un precio cargado en esa fecha." });
      const doc = await Modelo.findOneAndUpdate(
        { ...a, _id: id },
        { $set: { fecha, precio, cargadoPor: req.usuario?.usuario } },
        { returnDocument: "after", runValidators: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: "El precio no existe." });
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /** DELETE /:id */
  remove: async (req, res) => {
    const a = alcance(req);
    if (!a) return res.status(400).json({ error: "Ruta inválida." });
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Precio inválido." });
    try {
      const r = await Modelo.deleteOne({ ...a, _id: id });
      if (!r.deletedCount) return res.status(404).json({ error: "El precio no existe." });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
});

export const gasoil = controladores(PrecioGasoil);
export const dolar = controladores(PrecioDolar);
// Los del alquiler de la ruta: /alquileres/:alquiler/precios.
export const alquiler = controladores(PrecioAlquiler, (req) =>
  mongoose.isValidObjectId(req.params.alquiler) ? { alquiler: new mongoose.Types.ObjectId(req.params.alquiler) } : null
);
