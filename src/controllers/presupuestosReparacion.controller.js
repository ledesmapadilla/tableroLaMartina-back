import PresupuestoReparacion from "../models/PresupuestoReparacion.js";
import ChequeoSanPablo from "../models/ChequeoSanPablo.js";
import { SECCION_GENERAL } from "../catalogos/manitous.js";
import { borrarArchivo, estaConfigurado } from "../services/cloudinary.service.js";

// Presupuestos reparaciones (08/10/2026): los repuestos que el taller manda a
// cotizar desde Manitous › General. El analista los cotiza y quedan en
// "Cotizado"; no siguen el circuito de los pedidos.

const limpiar = (v) => String(v ?? "").trim();
const numero = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// GET: todos, o los de una fila de chequeo (?chequeo=id), para que la hoja de
// repuestos sepa cuáles ya se mandaron.
export const getAll = async (req, res) => {
  try {
    const filtro = req.query.chequeo ? { chequeo: req.query.chequeo } : {};
    const lista = await PresupuestoReparacion.find(filtro).sort({ nro: -1 }).lean();
    // `cantActual` (09/10/2026): la cantidad que tiene hoy el repuesto en su
    // fila, que pudo cambiar después de mandarlo; null si ya no está. La usa
    // el presupuesto de las Manitous.
    const filas = await ChequeoSanPablo.find({ _id: { $in: [...new Set(lista.map((p) => String(p.chequeo)))] } })
      .select("repuestos._id repuestos.cant")
      .lean();
    const cantidades = new Map(filas.flatMap((f) => f.repuestos.map((r) => [String(r._id), r.cant])));
    res.json(lista.map((p) => ({ ...p, cantActual: cantidades.get(String(p.repuesto)) ?? null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const p = await PresupuestoReparacion.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST { chequeo, repuesto }: manda a cotizar un repuesto de la fila, con sus
// datos de ese momento.
export const crear = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.body.chequeo);
    const repuesto = fila?.repuestos.id(req.body.repuesto);
    if (!repuesto) return res.status(404).json({ error: "Repuesto no encontrado" });
    // General es la plantilla (09/10/2026): se cotiza en cada Manitou.
    if (fila.seccion === SECCION_GENERAL) {
      return res.status(400).json({ error: "General es la plantilla: se cotiza en cada Manitou" });
    }
    const ya = await PresupuestoReparacion.findOne({ repuesto: repuesto._id }).lean();
    if (ya) return res.status(400).json({ error: `Ese repuesto ya se mandó a cotizar (${ya.estado})` });

    const usuario = limpiar(req.usuario?.nombre) || "Sistema";
    const p = await new PresupuestoReparacion({
      chequeo: fila._id,
      repuesto: repuesto._id,
      cosecha: fila.cosecha,
      sistema: fila.sistema,
      item: fila.item,
      nombre_repuesto: repuesto.nombre_repuesto,
      cant: repuesto.cant,
      unidad: repuesto.unidad,
      cc: repuesto.cc,
      descripcion: repuesto.descripcion,
      solicita: usuario,
      historial: [{ estado: "Para cotizar", usuario, nota: "Mandado a cotizar" }],
    }).save();
    res.status(201).json(p);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PUT: guarda la cotización. Con `cotizar: true` pasa a "Cotizado", y para eso
// necesita un precio o una observación que explique por qué no lo tiene,
// igual que el análisis de un pedido. El adjunto va solo, sin tocar lo demás.
export const actualizar = async (req, res) => {
  try {
    const p = await PresupuestoReparacion.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    const body = req.body;

    if ("archivo" in body) {
      const a = body.archivo;
      if (a && (!a.url || !a.publicId)) {
        return res.status(400).json({ error: "El adjunto tiene que traer la URL y el public_id." });
      }
      p.archivo = a
        ? { url: a.url, nombre: a.nombre, publicId: a.publicId, tipo: a.tipo, subidoPor: limpiar(req.usuario?.nombre), fecha: new Date() }
        : undefined;
    }

    const CAMPOS = ["stock", "precio1", "precio2", "precio3", "elegido"];
    for (const c of CAMPOS) if (c in body) p[c] = numero(body[c]);
    for (const c of ["proveedor1", "proveedor2", "proveedor3"]) if (c in body) p[c] = body[c] || null;
    if ("observaciones" in body) p.observaciones = limpiar(body.observaciones) || null;

    if (body.cotizar) {
      const conPrecio = [p.precio1, p.precio2, p.precio3].some((v) => Number(v) > 0);
      if (!conPrecio && !p.observaciones) {
        return res.status(400).json({ error: "Cargá un precio o una observación" });
      }
      const usuario = limpiar(req.usuario?.nombre) || "Analista";
      p.historial.push({
        estado: "Cotizado",
        usuario,
        nota: p.estado === "Cotizado" ? "Cotización editada" : "Cotizado",
      });
      p.estado = "Cotizado";
    } else if (p.estado === "Cotizado") {
      // Uno cotizado al que le sacaron el precio (desde la tabla del analista)
      // y no tiene observación vuelve a "Para cotizar".
      const conPrecio = [p.precio1, p.precio2, p.precio3].some((v) => Number(v) > 0);
      if (!conPrecio && !p.observaciones) {
        p.historial.push({ estado: "Para cotizar", usuario: limpiar(req.usuario?.nombre) || "Analista", nota: "Precio borrado" });
        p.estado = "Para cotizar";
      }
    }

    await p.save();
    res.json(p);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE (09/10/2026): lo borra el analista. El repuesto sigue en su fila y
// en la Manitou vuelve a "Pedir cotización": se puede mandar de nuevo. El
// adjunto, si tiene, se borra también de Cloudinary.
export const borrar = async (req, res) => {
  try {
    const p = await PresupuestoReparacion.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    if (p.archivo?.publicId && estaConfigurado()) {
      await borrarArchivo(p.archivo.publicId, p.archivo.tipo || "image").catch(() => {});
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
