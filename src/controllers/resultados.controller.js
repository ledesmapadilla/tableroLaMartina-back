import mongoose from "mongoose";
import OC from "../models/OC.js";
import BerdinaPedido from "../models/BerdinaPedido.js";
import SanPabloPedido from "../models/SanPabloPedido.js";
import CentroCosto from "../models/CentroCosto.js";
import Proveedor from "../models/Proveedor.js";

// Compras › Resultados (11/10/2026): lo gastado en plata por taller y por
// CC en un período. El gasto son las órdenes de pago: cada ítem de una OP
// suma su precio_total al CC de su ítem de pedido, en la columna del taller
// de la OP. El período es por la fecha de la OP.
//
// Por ahora lo ve solo nacho (index.routes.js); después pasa a la tabla de
// Roles.

const PEDIDOS = { berdina: BerdinaPedido, sanpablo: SanPabloPedido };
const SIN_CC = "Sin CC";

// "AAAA-MM-DD" en hora de Argentina; `fin` lleva hasta el último instante del
// día.
const fechaDe = (texto, fin = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || "")) return null;
  const d = new Date(`${texto}T${fin ? "23:59:59.999" : "00:00:00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Los ítems de las OP del período (?desde, ?hasta), cada uno con su taller y
// el CC de su pedido. Devuelve { error } si una fecha no sirve.
const itemsDelPeriodo = async (query) => {
  const desde = fechaDe(query.desde);
  const hasta = fechaDe(query.hasta, true);
  if ((query.desde && !desde) || (query.hasta && !hasta)) return { error: "Fecha inválida" };
  const filtro = {};
  if (desde || hasta) filtro.fecha = { ...(desde && { $gte: desde }), ...(hasta && { $lte: hasta }) };
  const ocs = await OC.find(filtro).select("establecimiento nro_oc_display fecha items").lean();

  // El CC de cada ítem de pedido, buscando solo los pedidos de esas OP.
  const idsPorTaller = { berdina: new Set(), sanpablo: new Set() };
  for (const oc of ocs) {
    for (const it of oc.items) {
      const taller = it._src || oc.establecimiento;
      if (idsPorTaller[taller]) idsPorTaller[taller].add(it.pedidoId);
    }
  }
  const ccDeItem = new Map();
  await Promise.all(
    Object.entries(idsPorTaller).map(async ([taller, ids]) => {
      if (!ids.size) return;
      const pedidos = await PEDIDOS[taller].find({ _id: { $in: [...ids] } }).select("items._id items.cc").lean();
      for (const p of pedidos) for (const i of p.items) ccDeItem.set(`${taller}:${i._id}`, (i.cc || "").trim());
    })
  );

  const items = [];
  for (const oc of ocs) {
    for (const it of oc.items) {
      const taller = it._src || oc.establecimiento;
      if (!PEDIDOS[taller]) continue;
      items.push({
        taller,
        cc: ccDeItem.get(`${taller}:${it.itemId}`) || SIN_CC,
        op: oc.nro_oc_display,
        fecha: oc.fecha,
        nro_pedido: it.nro_pedido,
        nombre_repuesto: it.nombre_repuesto,
        cant: it.cant,
        precio_unitario: it.precio_unitario,
        proveedor: it.proveedor,
        total: it.precio_total ?? (it.precio_unitario || 0) * (it.cant || 0),
      });
    }
  }
  return { items };
};

// GET ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (los dos opcionales)
// → [{ cc, descripcion, berdina, sanpablo, total }], por número de CC.
export const getResultados = async (req, res) => {
  try {
    const { items, error } = await itemsDelPeriodo(req.query);
    if (error) return res.status(400).json({ error });

    const porCC = new Map();
    for (const it of items) {
      if (!porCC.has(it.cc)) porCC.set(it.cc, { cc: it.cc, berdina: 0, sanpablo: 0 });
      porCC.get(it.cc)[it.taller] += it.total;
    }

    const centros = await CentroCosto.find({ cc: { $in: [...porCC.keys()] } }).select("cc descripcion").lean();
    const descripcion = new Map(centros.map((c) => [c.cc, c.descripcion || ""]));

    const filas = [...porCC.values()]
      .map((f) => ({ ...f, descripcion: descripcion.get(f.cc) || "", total: f.berdina + f.sanpablo }))
      // Sin CC al final; el resto por número.
      .sort((a, b) =>
        a.cc === SIN_CC ? 1 : b.cc === SIN_CC ? -1 : a.cc.localeCompare(b.cc, "es", { numeric: true })
      );
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ?desde&hasta&cc&taller: el resumen de un valor de la tabla, los ítems
// de OP que lo suman. Sin `cc`, todos los CC (la fila TOTAL); sin `taller`,
// los dos (la columna Total). El proveedor va con su razón social.
export const getResultadosDetalle = async (req, res) => {
  try {
    const { items, error } = await itemsDelPeriodo(req.query);
    if (error) return res.status(400).json({ error });
    const { cc, taller } = req.query;
    const elegidos = items.filter((it) => (!cc || it.cc === cc) && (!taller || it.taller === taller));

    const ids = [...new Set(elegidos.map((it) => it.proveedor).filter((p) => mongoose.isValidObjectId(p)))];
    const proveedores = ids.length ? await Proveedor.find({ _id: { $in: ids } }).select("razonsocial").lean() : [];
    const nombre = new Map(proveedores.map((p) => [String(p._id), p.razonsocial]));

    res.json(
      elegidos
        .map((it) => ({ ...it, proveedor: nombre.get(String(it.proveedor)) || it.proveedor || "" }))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
