import FilaContable, { CAMPOS_FILA } from "../models/FilaContable.js";
import TablaContable from "../models/TablaContable.js";
import { conBerdina } from "../catalogos/nombreBerdina.js";
import { claveTarea } from "../catalogos/claveTarea.js";
import { nombresCitrusvil } from "./equivalencias.controller.js";

const MAX_FILAS = 5000;
const NUMEROS = new Set(["cantidad", "precioUnitario", "subtotal"]);

/** El año y el mes de la URL, o null si no son válidos. */
const periodoDe = (req) => {
  const anio = Number(req.params.anio);
  const mes = Number(req.params.mes);
  if (!Number.isInteger(anio) || anio < 2000 || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
};

/** Una fila tal como llega del navegador, con solo los campos que van. */
const limpiarFila = (f, orden, periodo) => {
  const fila = { ...periodo, orden };
  for (const campo of CAMPOS_FILA) {
    const v = f?.[campo];
    if (v === undefined || v === null || v === "") continue;
    if (NUMEROS.has(campo)) {
      const n = Number(v);
      if (Number.isFinite(n)) fila[campo] = n;
    } else if (campo === "fecha") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) fila.fecha = d;
    } else {
      // Caspinchango se llama Berdina en todo el proyecto: el Excel todavía
      // lo trae con el nombre viejo (y a veces abreviado, "Caspinch").
      fila[campo] = conBerdina(String(v));
    }
  }
  // El importe es Cant. × Precio unitario, no el Subtotal del Excel
  // (08/11/2026): se calcula acá también, para no depender del navegador.
  if (fila.cantidad !== undefined && fila.precioUnitario !== undefined) {
    fila.subtotal = Math.round(fila.cantidad * fila.precioUnitario * 100) / 100;
  }
  return fila;
};

/**
 * GET /api/contable/estado/:anio/:mes → { tabla }
 *
 * Lo que necesita la pantalla del Excel mensual, sin traer las filas: si el
 * mes tiene tabla (de dónde salió, quién, cuándo). Un pedido chico, para que
 * la pantalla abra rápido.
 */
export const getEstado = async (req, res) => {
  const periodo = periodoDe(req);
  if (!periodo) return res.status(400).json({ error: "Mes inválido." });
  try {
    const [tabla, hayFilas] = await Promise.all([TablaContable.findOne(periodo).lean(), FilaContable.exists(periodo)]);
    res.json({ tabla: hayFilas ? tabla || {} : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** GET /api/contable/filas/:anio/:mes → { filas, tabla } (tabla: de dónde salió). */
export const getFilas = async (req, res) => {
  const periodo = periodoDe(req);
  if (!periodo) return res.status(400).json({ error: "Mes inválido." });
  try {
    // Solo lo que muestra la tabla: sin anio, mes, orden ni fechas de alta,
    // que repetidos en cada fila eran un tercio de lo que viajaba (05/11/2026).
    const campos = ["_id", ...CAMPOS_FILA].join(" ");
    const [filas, tabla] = await Promise.all([
      FilaContable.find(periodo).select(campos).sort({ orden: 1 }).lean(),
      TablaContable.findOne(periodo).select("origen cargadaPor fecha").lean(),
    ]);
    res.json({ filas, tabla: tabla || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/filas/:anio/:mes  { filas: [...], origen: "nombre.xlsx" }
 *
 * Arma la tabla del mes con las filas que leyó el navegador del Excel
 * (utils/leerExcelContable.js), ya sin los subtotales. Si el mes ya tiene
 * tabla no la pisa: primero hay que borrarla (DELETE), y recién ahí se sube
 * otro Excel.
 */
export const putFilas = async (req, res) => {
  const periodo = periodoDe(req);
  if (!periodo) return res.status(400).json({ error: "Mes inválido." });
  const { filas, origen } = req.body || {};
  if (!Array.isArray(filas)) return res.status(400).json({ error: "Faltan las filas." });
  if (filas.length > MAX_FILAS) {
    return res.status(400).json({ error: `El Excel no puede pasar de ${MAX_FILAS} filas.` });
  }
  try {
    const [yaHay, nombres] = await Promise.all([FilaContable.exists(periodo), nombresCitrusvil()]);
    if (yaHay) {
      return res.status(409).json({ error: "El mes ya tiene tabla. Para subir otro Excel, primero borrá la tabla." });
    }
    const docs = filas.map((f, i) => limpiarFila(f, i, periodo));
    // Cada tarea de Citrusvil con el nombre que ya existe para su clave (sin
    // mayúsculas, acentos, espacios ni signos): así una variante escrita
    // distinto es la misma tarea y sus equivalencias siguen valiendo
    // (05/11/2026). Dentro del mismo Excel, manda la primera que aparece.
    for (const d of docs) {
      const k = claveTarea(d.tarea);
      if (!k) continue;
      if (nombres.has(k)) d.tarea = nombres.get(k);
      else nombres.set(k, d.tarea);
    }
    if (docs.length) await FilaContable.insertMany(docs);
    await TablaContable.findOneAndUpdate(
      periodo,
      { ...periodo, origen: origen ? String(origen) : undefined, cargadaPor: req.usuario?.usuario, fecha: new Date() },
      { upsert: true, returnDocument: "after" }
    );
    res.json({ ok: true, cantidad: docs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** DELETE /api/contable/filas/:anio/:mes: borra la tabla del mes entera. */
export const deleteFilas = async (req, res) => {
  const periodo = periodoDe(req);
  if (!periodo) return res.status(400).json({ error: "Mes inválido." });
  try {
    await FilaContable.deleteMany(periodo);
    await TablaContable.deleteOne(periodo);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

