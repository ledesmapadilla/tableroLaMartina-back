import mongoose from "mongoose";
import EquivalenciaTarea from "../models/EquivalenciaTarea.js";
import EquivalenciaCostos from "../models/EquivalenciaCostos.js";
import FilaContable from "../models/FilaContable.js";
import Tarea from "../models/Tarea.js";
import TareaCitrusvil from "../models/TareaCitrusvil.js";
import EquivalenciaUnidad from "../models/EquivalenciaUnidad.js";
import { UNIDADES_LA_MARTINA, formaUnidad, unidadConocida, unidadLaMartina } from "../catalogos/unidadesTarea.js";
import { claveTarea as clave } from "../catalogos/claveTarea.js";

const limpiar = (t) => String(t || "").trim().replace(/\s+/g, " ");

/**
 * Las unidades de Citrusvil cargadas a mano (08/11/2026), las que no están en
 * catalogos/unidadesTarea.js. → Map forma → unidad de La Martina
 */
const unidadesExtra = async () =>
  new Map((await EquivalenciaUnidad.find({}).select("forma unidad").lean()).map((e) => [e.forma, e.unidad]));

/**
 * Los nombres de las tareas de Citrusvil (de los Excel y agregadas) que vienen
 * en esa unidad (su forma: "JOR").
 */
const tareasEnUnidad = async (forma) => {
  const [filas, agregadas] = await Promise.all([
    FilaContable.aggregate([
      { $match: { unidad: { $nin: [null, ""] } } },
      { $group: { _id: "$unidad", tareas: { $addToSet: "$tarea" } } },
    ]),
    TareaCitrusvil.find({ unidad: { $nin: [null, ""] } }).select("nombre unidad").lean(),
  ]);
  return [
    ...new Set([
      ...filas.filter((u) => formaUnidad(u._id) === forma).flatMap((u) => u.tareas),
      ...agregadas.filter((a) => formaUnidad(a.unidad) === forma).map((a) => a.nombre),
    ]),
  ].filter(Boolean);
};

/**
 * El nombre con el que queda cada tarea de Citrusvil, por su clave (sin
 * mayúsculas, acentos, espacios ni signos: catalogos/claveTarea.js). Si la
 * misma tarea está escrita de varias formas, manda la que ya está en una
 * equivalencia, después la agregada a mano y por último la de los Excel
 * (05/11/2026). → Map clave → nombre
 *
 * Lo usa también la carga del Excel (contable.controller.js), para guardar
 * cada fila con el nombre que ya existe.
 */
export const nombresCitrusvil = async () => {
  const [equivalencias, costos, agregadas, deExcel] = await Promise.all([
    EquivalenciaTarea.find({}).select("citrusvil").lean(),
    EquivalenciaCostos.find({}).select("nombre").lean(),
    TareaCitrusvil.find({}).select("nombre").lean(),
    FilaContable.distinct("tarea"),
  ]);
  const nombres = new Map();
  const sumar = (n) => {
    const k = clave(n);
    if (k && !nombres.has(k)) nombres.set(k, n);
  };
  for (const e of equivalencias) for (const c of e.citrusvil || []) sumar(c);
  for (const c of costos) sumar(c.nombre);
  for (const a of agregadas) sumar(a.nombre);
  for (const n of [...deExcel].sort()) sumar(n);
  return nombres;
};

/**
 * Las tareas de Citrusvil: las de las tablas mensuales (con la unidad con la
 * que vienen en el Excel) más las agregadas a mano, sin repetir: dos escritas
 * distinto pero con la misma clave son una sola, con el nombre que manda
 * (nombresCitrusvil).
 * → [{ nombre, unidad, origen: "excel" | "agregada", _id? }]
 */
const listarCitrusvil = async () => {
  const [deExcel, agregadas, nombres, extras] = await Promise.all([
    FilaContable.aggregate([
      { $match: { tarea: { $nin: [null, ""] } } },
      { $group: { _id: "$tarea", unidad: { $first: "$unidad" } } },
    ]),
    TareaCitrusvil.find({}).select("nombre unidad").lean(),
    nombresCitrusvil(),
    unidadesExtra(),
  ]);
  const porClave = new Map();
  // La unidad, con el nombre de La Martina ("HRA" → Horas, "PLA" → Plantas).
  // Una que no se reconoce queda como vino y marcada `unidadNueva`: hasta que
  // se diga a cuál equivale, esa tarea no se puede unir (08/11/2026).
  const conUnidad = (u) => ({
    unidad: unidadLaMartina(u, extras),
    ...(u && !unidadConocida(u, extras) ? { unidadNueva: true } : {}),
  });
  for (const t of deExcel) {
    const k = clave(t._id);
    if (!k || porClave.has(k)) continue;
    porClave.set(k, { nombre: nombres.get(k) || t._id, ...conUnidad(t.unidad), origen: "excel" });
  }
  for (const a of agregadas) {
    const k = clave(a.nombre);
    if (!k || porClave.has(k)) continue;
    porClave.set(k, { _id: a._id, nombre: nombres.get(k) || a.nombre, ...conUnidad(a.unidad), origen: "agregada" });
  }
  return [...porClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
};

/**
 * Las tareas de Citrusvil de `nombres` que no van en la misma unidad que la
 * tarea de La Martina (05/11/2026): esas no pueden ser equivalentes. Si a una
 * de las dos le falta la unidad, no se controla.
 * → [{ nombre, unidad }]
 */
const conOtraUnidad = (nombres, tareaLM, unidades) => {
  const unidadLM = unidadLaMartina(tareaLM?.unidad);
  if (!unidadLM || !nombres.length) return [];
  return nombres
    .filter((n) => unidades.get(n) && unidades.get(n) !== unidadLM)
    .map((n) => ({ nombre: n, unidad: unidades.get(n) }));
};

/**
 * La unidad (con el nombre de La Martina) de solo esas tareas de Citrusvil:
 * las de los Excel y las agregadas a mano. Es lo que necesita el control al
 * guardar, sin armar el listado entero (05/11/2026: guardar tardaba).
 */
const unidadesDe = async (nombres) => {
  const unidades = new Map();
  // Las que van en una unidad que todavía no tiene equivalencia: nombre → unidad.
  unidades.nuevas = new Map();
  if (!nombres.length) return unidades;
  const [deExcel, agregadas, extras] = await Promise.all([
    FilaContable.aggregate([
      { $match: { tarea: { $in: nombres } } },
      { $group: { _id: "$tarea", unidad: { $first: "$unidad" } } },
    ]),
    TareaCitrusvil.find({ nombre: { $in: nombres } }).select("nombre unidad").lean(),
    unidadesExtra(),
  ]);
  // Manda la del Excel sobre la agregada, como antes.
  for (const t of [...agregadas.map((a) => ({ _id: a.nombre, unidad: a.unidad })), ...deExcel]) {
    unidades.set(t._id, unidadLaMartina(t.unidad, extras));
    if (t.unidad && !unidadConocida(t.unidad, extras)) unidades.nuevas.set(t._id, String(t.unidad).trim());
    else unidades.nuevas.delete(t._id);
  }
  return unidades;
};

/** El error si alguna de `nombres` va en una unidad sin equivalencia, o null. */
const conUnidadNueva = (nombres, unidades) => {
  const nuevas = nombres.filter((n) => unidades.nuevas?.has(n));
  if (!nuevas.length) return null;
  return (
    nuevas.map((n) => `«${n}» va en «${unidades.nuevas.get(n)}»`).join(", ") +
    ", una unidad nueva: primero hay que decir a qué unidad de La Martina equivale (arriba, en Unidades nuevas de Citrusvil)."
  );
};

const mensajeOtraUnidad = (distintas, tareaLM) =>
  `${tareaLM.tarea} va en ${unidadLaMartina(tareaLM.unidad)} y ` +
  distintas.map((d) => `«${d.nombre}» en ${d.unidad}`).join(", ") +
  ": con distinta unidad no puede ser equivalencia.";

/**
 * GET /api/contable/equivalencias
 * → { equivalencias: [{ tarea, citrusvil, observaciones }], citrusvil: [{ nombre, unidad, origen }],
 *     costos: [{ nombre, tareas: [id] }] }
 *
 * `citrusvil` son todas las tareas de Citrusvil, las de las tablas mensuales
 * y las agregadas a mano: las que hay para tildar. `costos`, las de Citrusvil
 * que en la Comparativa de costos van con otras tareas (EquivalenciaCostos).
 * `unidades`, las unidades de Citrusvil nuevas y las ya cargadas
 * (estadoUnidades).
 */
export const getEquivalencias = async (req, res) => {
  try {
    const [equivalencias, citrusvil, costos, unidades] = await Promise.all([
      EquivalenciaTarea.find({}).select("tarea citrusvil observaciones").lean(),
      listarCitrusvil(),
      EquivalenciaCostos.find({}).select("nombre tareas").lean(),
      estadoUnidades(),
    ]);
    res.json({ equivalencias, citrusvil, costos, unidades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/contable/tareas-citrusvil  { nombre, unidad }
 *
 * Agrega una tarea de Citrusvil a mano, para usarla en las equivalencias
 * aunque todavía no haya venido en ningún Excel. No se repite con una que ya
 * esté (de un Excel o agregada), sin contar mayúsculas ni acentos.
 */
export const postTareaCitrusvil = async (req, res) => {
  const nombre = limpiar(req.body?.nombre);
  // Con las unidades de La Martina, igual que las que vienen de los Excel.
  const crudaUnidad = limpiar(req.body?.unidad);
  if (!nombre) return res.status(400).json({ error: "Falta el nombre de la tarea." });
  if (nombre.length > 150) return res.status(400).json({ error: "El nombre no puede pasar de 150 caracteres." });
  if (!clave(nombre)) return res.status(400).json({ error: "El nombre tiene que tener letras o números." });
  try {
    // Ya existe si coincide la clave: sin mayúsculas, acentos, espacios ni signos.
    const [lista, extras] = await Promise.all([listarCitrusvil(), unidadesExtra()]);
    const ya = lista.find((t) => clave(t.nombre) === clave(nombre));
    if (ya) return res.status(400).json({ error: `Ya existe la tarea «${ya.nombre}».` });
    const unidad = unidadLaMartina(crudaUnidad, extras);
    const tarea = await TareaCitrusvil.create({ nombre, unidad, creadaPor: req.usuario?.usuario });
    res.status(201).json(tarea);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/contable/tareas-citrusvil/:id
 *
 * Saca una tarea agregada a mano. No se deja si está en alguna equivalencia:
 * primero hay que destildarla.
 */
export const deleteTareaCitrusvil = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Tarea inválida." });
  try {
    const tarea = await TareaCitrusvil.findById(id).lean();
    if (!tarea) return res.status(404).json({ error: "La tarea no existe." });
    const [usada, enCostos] = await Promise.all([
      EquivalenciaTarea.findOne({ citrusvil: tarea.nombre }).populate("tarea", "tarea").lean(),
      EquivalenciaCostos.exists({ nombre: tarea.nombre }),
    ]);
    if (usada) {
      return res
        .status(409)
        .json({ error: `Está en la equivalencia de ${usada.tarea?.tarea || "otra tarea"}: primero hay que destildarla.` });
    }
    if (enCostos) {
      return res.status(409).json({ error: "Tiene una equivalencia para costos: primero hay que sacarla." });
    }
    await TareaCitrusvil.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/equivalencias/:tareaId  { citrusvil: [texto], observaciones }
 *
 * Guarda las tareas de Citrusvil que equivalen a esa tarea de La Martina. Una
 * de Citrusvil puede estar en varias tareas de La Martina (06/11/2026); lo
 * que no se deja es que vaya en otra unidad.
 */
export const putEquivalencia = async (req, res) => {
  const { tareaId } = req.params;
  if (!mongoose.isValidObjectId(tareaId)) return res.status(400).json({ error: "Tarea inválida." });
  const { citrusvil, observaciones } = req.body || {};
  if (!Array.isArray(citrusvil)) return res.status(400).json({ error: "Faltan las tareas de Citrusvil." });
  // Sin repetir por clave: "Alq. Tractor" y "alq tractor" son una sola.
  const porClave = new Map();
  for (const c of citrusvil.map((x) => String(x).trim()).filter(Boolean)) if (!porClave.has(clave(c))) porClave.set(clave(c), c);
  const lista = [...porClave.values()];
  try {
    // Los controles van juntos: la base tarda en contestar (05/11/2026).
    const [tareaLM, unidades] = await Promise.all([
      Tarea.findById(tareaId).select("tarea unidad").lean(),
      unidadesDe(lista),
    ]);
    if (!tareaLM) return res.status(404).json({ error: "La tarea no existe." });

    const nueva = conUnidadNueva(lista, unidades);
    if (nueva) return res.status(400).json({ error: nueva });
    const distintas = conOtraUnidad(lista, tareaLM, unidades);
    if (distintas.length) return res.status(400).json({ error: mensajeOtraUnidad(distintas, tareaLM) });

    const obs = observaciones ? String(observaciones).trim() : "";
    // Sin nada tildado ni observaciones, no queda equivalencia que guardar.
    if (!lista.length && !obs) {
      await EquivalenciaTarea.deleteOne({ tarea: tareaId });
      return res.json({ equivalencia: null });
    }
    await EquivalenciaTarea.updateOne(
      { tarea: tareaId },
      { tarea: tareaId, citrusvil: lista, observaciones: obs },
      { upsert: true, runValidators: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/equivalencias-ctv  { nombre, tareas: [id] }
 *
 * La equivalencia vista desde Citrusvil (la solapa Ctv → LM): la tarea de
 * Citrusvil `nombre` queda en exactamente esas tareas de La Martina (puede
 * ser más de una, 06/11/2026) y sale de las demás. Con la lista vacía queda
 * sin equivalencia. Una equivalencia que queda sin tareas ni observaciones se
 * borra. Todas tienen que ir en la misma unidad que la de Citrusvil.
 *
 * Acepta también `tarea` (una sola), como antes.
 */
export const putEquivalenciaCtv = async (req, res) => {
  const pedido = String(req.body?.nombre || "").trim();
  const crudas = Array.isArray(req.body?.tareas) ? req.body.tareas : req.body?.tarea ? [req.body.tarea] : [];
  const tareas = [...new Set(crudas.map(String).filter(Boolean))];
  if (!pedido) return res.status(400).json({ error: "Falta la tarea de Citrusvil." });
  if (tareas.some((t) => !mongoose.isValidObjectId(t))) return res.status(400).json({ error: "Tarea inválida." });
  try {
    const [tareasLM, unidades, nombres] = await Promise.all([
      tareas.length ? Tarea.find({ _id: { $in: tareas } }).select("tarea unidad").lean() : [],
      tareas.length ? unidadesDe([pedido]) : new Map(),
      nombresCitrusvil(),
    ]);
    // Con el nombre que manda para esa clave (05/11/2026): una variante
    // escrita distinto cae en la misma tarea.
    const nombre = nombres.get(clave(pedido)) || pedido;
    if (tareasLM.length !== tareas.length) return res.status(404).json({ error: "Alguna tarea no existe." });
    const nueva = conUnidadNueva([pedido], unidades);
    if (nueva) return res.status(400).json({ error: nueva });
    for (const t of tareasLM) {
      const distintas = conOtraUnidad([pedido], t, unidades);
      if (distintas.length) return res.status(400).json({ error: mensajeOtraUnidad(distintas, t) });
    }

    // Las escrituras en un solo viaje a la base, en orden: se saca de las que
    // no van, se pone en cada una de las que van y se borran las que quedaron
    // vacías, que ya no son equivalencia.
    const ids = tareas.map((t) => new mongoose.Types.ObjectId(t));
    await EquivalenciaTarea.bulkWrite(
      [
        {
          updateMany: {
            filter: { citrusvil: nombre, tarea: { $nin: ids } },
            update: { $pull: { citrusvil: nombre } },
          },
        },
        ...ids.map((id) => ({
          updateOne: { filter: { tarea: id }, update: { $addToSet: { citrusvil: nombre } }, upsert: true },
        })),
        {
          deleteMany: {
            filter: { citrusvil: { $size: 0 }, $or: [{ observaciones: { $exists: false } }, { observaciones: "" }] },
          },
        },
      ],
      { ordered: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/equivalencias-costos  { nombre, tareas: [id] }
 *
 * La equivalencia de la tarea de Citrusvil `nombre` solo para la Comparativa
 * de costos (07/11/2026): ahí va con esas tareas de La Martina en vez de las
 * de siempre. Con la lista vacía se borra y en costos vuelve a ir con las de
 * siempre. Todas en la misma unidad que la de Citrusvil.
 */
export const putEquivalenciaCostos = async (req, res) => {
  const pedido = String(req.body?.nombre || "").trim();
  const crudas = Array.isArray(req.body?.tareas) ? req.body.tareas : [];
  const tareas = [...new Set(crudas.map(String).filter(Boolean))];
  if (!pedido) return res.status(400).json({ error: "Falta la tarea de Citrusvil." });
  if (tareas.some((t) => !mongoose.isValidObjectId(t))) return res.status(400).json({ error: "Tarea inválida." });
  try {
    const [tareasLM, unidades, nombres] = await Promise.all([
      tareas.length ? Tarea.find({ _id: { $in: tareas } }).select("tarea unidad").lean() : [],
      tareas.length ? unidadesDe([pedido]) : new Map(),
      nombresCitrusvil(),
    ]);
    const nombre = nombres.get(clave(pedido)) || pedido;
    if (tareasLM.length !== tareas.length) return res.status(404).json({ error: "Alguna tarea no existe." });
    const nueva = conUnidadNueva([pedido], unidades);
    if (nueva) return res.status(400).json({ error: nueva });
    for (const t of tareasLM) {
      const distintas = conOtraUnidad([pedido], t, unidades);
      if (distintas.length) return res.status(400).json({ error: mensajeOtraUnidad(distintas, t) });
    }
    if (!tareas.length) {
      await EquivalenciaCostos.deleteOne({ nombre });
      return res.json({ ok: true });
    }
    await EquivalenciaCostos.updateOne(
      { nombre },
      { nombre, tareas: tareas.map((t) => new mongoose.Types.ObjectId(t)) },
      { upsert: true, runValidators: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** DELETE /api/contable/equivalencias/:tareaId: saca la equivalencia de esa tarea. */
export const deleteEquivalencia = async (req, res) => {
  const { tareaId } = req.params;
  if (!mongoose.isValidObjectId(tareaId)) return res.status(400).json({ error: "Tarea inválida." });
  try {
    await EquivalenciaTarea.deleteOne({ tarea: tareaId });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Unidades de Citrusvil nuevas (08/11/2026) ──

/**
 * Las unidades de Citrusvil que no se reconocen (las nuevas, con sus tareas)
 * y las que ya se cargaron a mano.
 * → { nuevas: [{ forma, unidad, tareas: [nombre] }], cargadas: [{ _id, forma, unidad }] }
 */
async function estadoUnidades() {
  const [deExcel, agregadas, cargadas] = await Promise.all([
    FilaContable.aggregate([
      { $match: { unidad: { $nin: [null, ""] } } },
      { $group: { _id: "$unidad", tareas: { $addToSet: "$tarea" } } },
    ]),
    TareaCitrusvil.find({ unidad: { $nin: [null, ""] } }).select("nombre unidad").lean(),
    EquivalenciaUnidad.find({}).select("forma unidad").sort({ forma: 1 }).lean(),
  ]);
  const extras = new Map(cargadas.map((e) => [e.forma, e.unidad]));
  const nuevas = new Map();
  const sumar = (unidad, tareas) => {
    if (unidadConocida(unidad, extras)) return;
    const forma = formaUnidad(unidad);
    if (!forma) return;
    const n = nuevas.get(forma) || { forma, unidad: String(unidad).trim(), tareas: [] };
    for (const t of tareas) if (t && !n.tareas.includes(t)) n.tareas.push(t);
    nuevas.set(forma, n);
  };
  for (const u of deExcel) sumar(u._id, u.tareas);
  for (const a of agregadas) sumar(a.unidad, [a.nombre]);
  for (const n of nuevas.values()) n.tareas.sort((a, b) => a.localeCompare(b, "es"));
  return { nuevas: [...nuevas.values()], cargadas };
}

/** GET /api/contable/unidades → estadoUnidades. Lo pide la pantalla del mes al cargar un Excel. */
export const getUnidades = async (req, res) => {
  try {
    res.json(await estadoUnidades());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/contable/unidades  { forma, unidad }
 *
 * Dice a qué unidad de La Martina equivale una unidad de Citrusvil que no se
 * reconocía. Si ya tenía, la cambia. Las del catálogo fijo (HRA, PLA…) no se
 * tocan.
 */
export const putUnidad = async (req, res) => {
  const forma = formaUnidad(req.body?.forma);
  const unidad = String(req.body?.unidad || "").trim();
  if (!forma) return res.status(400).json({ error: "Falta la unidad de Citrusvil." });
  if (!UNIDADES_LA_MARTINA.includes(unidad)) return res.status(400).json({ error: "La unidad de La Martina no es válida." });
  const fija = unidadConocida(forma);
  if (fija) return res.status(400).json({ error: `«${forma}» ya equivale a ${fija}: no se puede cambiar.` });
  try {
    // Si una tarea en esa unidad ya está en una equivalencia (porque se la
    // cambia de una a otra), con la nueva unidad quedaría mal: no se deja.
    const nombres = await tareasEnUnidad(forma);
    if (nombres.length) {
      const enUso = await EquivalenciaTarea.find({ citrusvil: { $in: nombres } }).populate("tarea", "tarea unidad").lean();
      const mal = enUso.filter((e) => e.tarea && unidadLaMartina(e.tarea.unidad) !== unidad);
      if (mal.length) {
        return res.status(409).json({
          error: `Con ${unidad} no coincidiría con ${mal.map((e) => e.tarea.tarea).join(", ")}, que ya tiene tareas en «${forma}»: primero sacá esas equivalencias.`,
        });
      }
    }
    await EquivalenciaUnidad.updateOne(
      { forma },
      { forma, unidad, creadaPor: req.usuario?.usuario },
      { upsert: true, runValidators: true }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** DELETE /api/contable/unidades/:id: la unidad vuelve a quedar sin equivalencia. */
export const deleteUnidad = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Unidad inválida." });
  try {
    const doc = await EquivalenciaUnidad.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "La unidad no existe." });
    // Si alguna tarea en esa unidad ya está en una equivalencia, quedaría
    // unida sin unidad conocida: no se deja.
    const nombres = await tareasEnUnidad(doc.forma);
    const usada = nombres.length
      ? (await EquivalenciaTarea.exists({ citrusvil: { $in: nombres } })) ||
        (await EquivalenciaCostos.exists({ nombre: { $in: nombres } }))
      : null;
    if (usada) {
      return res.status(409).json({ error: `Hay tareas en «${doc.forma}» con equivalencia: primero hay que sacarlas.` });
    }
    await EquivalenciaUnidad.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
