/**
 * Reglas del horómetro, compartidas por todas las pantallas que cargan una
 * lectura: visitas, services, reparaciones, carga manual y el parte diario de
 * Producción. Vive acá y no en cada controller para que la regla sea una sola.
 *
 * REGLA: toda lectura debe ser mayor o igual a la última anterior a su fecha.
 * La única forma legítima de que baje es un cambio de horómetro, que se
 * registra explícitamente en CambioHorometro.
 */
import Tractor from "../models/Tractor.js";
import Visita from "../models/Visita.js";
import ServiceTractor from "../models/ServiceTractor.js";
import TrabajoTractor from "../models/TrabajoTractor.js";
import HorometroTractor from "../models/HorometroTractor.js";
import ParteDiario from "../models/ParteDiario.js";
import CentroCosto from "../models/CentroCosto.js";
import CambioHorometro from "../models/CambioHorometro.js";

// Devuelve el número de un valor libre ("1519", "1519 hs", "S/H", 1519).
export const parsearHorometro = (valor) => {
  if (valor === null || valor === undefined) return null;
  const str = String(valor).trim();
  if (!str || str.toUpperCase() === "S/H") return null;
  const match = str.match(/[\d]+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(",", "."));
  return isNaN(num) ? null : num;
};

const aDia = (fecha) => {
  if (!fecha) return new Date().toISOString().split("T")[0];
  if (typeof fecha === "string") return fecha.split("T")[0];
  return new Date(fecha).toISOString().split("T")[0];
};

const limpiarCC = (cc) => String(cc || "").replace(/^cc\s*/i, "").trim();

// ── Cambios de horómetro ──────────────────────────────────────────────

// Cambios del tractor, del más viejo al más nuevo.
export const cambiosDeTractor = (tractorId) =>
  CambioHorometro.find({ tractor: tractorId }).sort({ fecha: 1, createdAt: 1 }).lean();

// Qué horómetro estaba en servicio en esa fecha: su número y la base de horas
// acumuladas de los anteriores.
export const horometroVigente = async (tractorId, fecha) => {
  const dia = aDia(fecha);
  const cambios = await cambiosDeTractor(tractorId);
  const previos = cambios.filter((c) => aDia(c.fecha) <= dia);
  if (previos.length === 0) return { numero: 1, base: 0, desde: null };
  const ultimo = previos[previos.length - 1];
  return { numero: ultimo.numero, base: ultimo.base, desde: aDia(ultimo.fecha) };
};

// Horas reales de la máquina: lo acumulado por los horómetros anteriores más
// lo que marca el actual. Es el número con el que hay que calcular el service.
export const horasAcumuladas = async (tractorId, lectura, fecha) => {
  const valor = parsearHorometro(lectura);
  if (valor === null) return null;
  const { base } = await horometroVigente(tractorId, fecha);
  return Math.round((base + valor) * 100) / 100;
};

// ── Versiones en lote ─────────────────────────────────────────────────
// Las pantallas de preventivo resuelven decenas de tractores de una sola vez:
// pedir los cambios de a uno sería una consulta por fila.

// tractorId (string) -> cambios ordenados del más viejo al más nuevo.
export const mapaDeCambios = async () => {
  const todos = await CambioHorometro.find().sort({ fecha: 1, createdAt: 1 }).lean();
  const mapa = new Map();
  for (const c of todos) {
    const k = String(c.tractor);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(c);
  }
  return mapa;
};

// Qué horómetro regía en esa fecha, a partir de los cambios ya cargados.
export const vigenteEn = (cambios, fecha) => {
  const dia = aDia(fecha);
  const previos = (cambios || []).filter((c) => aDia(c.fecha) <= dia);
  if (previos.length === 0) return { numero: 1, base: 0, desde: null };
  const ultimo = previos[previos.length - 1];
  return { numero: ultimo.numero, base: ultimo.base, desde: aDia(ultimo.fecha) };
};

// Suma la base a una lectura suelta. Sin cambios cargados devuelve la lectura
// tal cual, así el sistema se comporta igual que antes hasta que haya uno.
export const acumularConCambios = (cambios, lectura, fecha) => {
  const valor = parsearHorometro(lectura);
  if (valor === null) return { acumuladas: null, numero: 1 };
  const { numero, base } = vigenteEn(cambios, fecha);
  return { acumuladas: Math.round((base + valor) * 100) / 100, numero };
};

// ── Lecturas ya cargadas ──────────────────────────────────────────────

/**
 * Todas las lecturas del tractor, de las cinco fuentes, como
 * { fecha, horometro, fuente, id }. Sin ordenar.
 */
export const lecturasDeTractor = async (tractorId, tractorPrecargado = null) => {
  // El que llama suele tener el tractor a mano (el parte llega con el CC y su
  // tractor ya poblados): releerlo es una consulta de más.
  const tractor = tractorPrecargado || (await Tractor.findById(tractorId).lean());
  if (!tractor) return [];
  const cc = limpiarCC(tractor.cc);
  const lecturas = [];

  const push = (fecha, valor, fuente, id) => {
    const n = parsearHorometro(valor);
    if (n === null) return;
    lecturas.push({ fecha: aDia(fecha), horometro: n, fuente, id: String(id) });
  };

  const [services, trabajos, manuales, centros, visitas] = await Promise.all([
    ServiceTractor.find({ tractor: tractorId }).select("fecha horometro").lean(),
    TrabajoTractor.find({ tractor: tractorId, horometro: { $nin: ["", null] } })
      .select("fecha horometro")
      .lean(),
    HorometroTractor.find({ tractor: tractorId }).select("fecha horometro origen").lean(),
    CentroCosto.find({ tractor: tractorId }).select("_id").lean(),
    Visita.find({ horometro: { $exists: true, $ne: "" } }).select("fecha cc horometro").lean(),
  ]);

  services.forEach((s) => push(s.fecha, s.horometro, "service", s._id));
  trabajos.forEach((t) => push(t.fecha, t.horometro, "reparacion", t._id));
  manuales.forEach((h) => push(h.fecha, h.horometro, `horometro:${h.origen || "manual"}`, h._id));

  if (centros.length) {
    const ids = centros.map((c) => c._id);
    const filas = await ParteDiario.find({
      cc: { $in: ids },
      $or: [{ horomIngreso: { $ne: null } }, { horomSalida: { $ne: null } }],
    })
      .select("fecha horomIngreso horomSalida")
      .lean();
    filas.forEach((p) => {
      push(p.fecha, p.horomIngreso, "parte", p._id);
      push(p.fecha, p.horomSalida, "parte", p._id);
    });
  }

  // Las visitas guardan el CC como texto y pueden traer varios en un campo:
  // "CC 12: 3400, CC 15: 890".
  visitas.forEach((v) => {
    const h = String(v.horometro).trim();
    const ccStr = String(v.cc || "").trim();
    if (h.includes(":") || ccStr.includes(",")) {
      for (const m of h.matchAll(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi)) {
        if (limpiarCC(m[1]) === cc) push(v.fecha, m[2], "visita", v._id);
      }
    } else if (limpiarCC(ccStr) === cc) {
      push(v.fecha, h, "visita", v._id);
    }
  });

  return lecturas;
};

/**
 * Todo lo que hace falta para validar lecturas de un tractor en una fecha: qué
 * horómetro regía y el historial completo. Se pide una vez y se reusa, porque
 * una misma carga valida varias lecturas del mismo tractor y el mismo día (un
 * parte diario trae ingreso y salida): resolverlo por lectura duplicaba todas
 * las consultas.
 */
export const contextoDeHorometro = async (tractorId, fecha, tractorPrecargado = null) => {
  const [vigente, lecturas] = await Promise.all([
    horometroVigente(tractorId, fecha),
    lecturasDeTractor(tractorId, tractorPrecargado),
  ]);
  return { vigente, lecturas };
};

/**
 * La lectura más alta anterior o igual a una fecha, dentro del horómetro que
 * estaba en servicio en ese momento. Se toma el máximo y no la última en el
 * tiempo para que una carga vieja y errónea no habilite otra por debajo.
 *
 * `ignorarId` sirve al editar: el propio registro no se compara consigo mismo.
 * `contexto` (de `contextoDeHorometro`) evita releer el historial.
 */
export const ultimaLecturaAntesDe = async (tractorId, fecha, ignorarId = null, contexto = null) => {
  const dia = aDia(fecha);
  const { vigente, lecturas } = contexto || (await contextoDeHorometro(tractorId, fecha));
  const { desde } = vigente;

  const previas = lecturas.filter(
    (l) =>
      l.fecha <= dia &&
      // Las lecturas del horómetro anterior no se comparan con las del nuevo.
      (!desde || l.fecha >= desde) &&
      (!ignorarId || l.id !== String(ignorarId))
  );

  if (previas.length === 0) return null;
  return previas.reduce((a, b) => (b.horometro > a.horometro ? b : a));
};

// ── Validación ────────────────────────────────────────────────────────

/**
 * Verifica una lectura contra la regla.
 * Devuelve { ok: true } o { ok: false, motivo, ultima, lectura }.
 * Un valor vacío o "S/H" no es un error: simplemente no hay lectura.
 */
export const validarLectura = async ({
  tractor,
  fecha,
  horometro,
  ignorarId = null,
  contexto = null,
}) => {
  const lectura = parsearHorometro(horometro);
  if (lectura === null || !tractor) return { ok: true, lectura: null };

  const ultima = await ultimaLecturaAntesDe(tractor, fecha, ignorarId, contexto);
  if (!ultima || lectura >= ultima.horometro) return { ok: true, lectura, ultima };

  const mensaje =
    `La lectura ${lectura} es menor que el último horómetro registrado ` +
    `(${ultima.horometro} del ${ultima.fecha}).`;

  return {
    ok: false,
    motivo: "HOROMETRO_RETROCEDE",
    lectura,
    ultima,
    mensaje,
    // Las pantallas que todavía no muestran el diálogo de tres opciones leen
    // `error`: así al menos avisan lo que pasó en vez de un error genérico.
    error: mensaje,
  };
};

/**
 * Una visita guarda el CC como texto y puede anotar varios tractores en el
 * mismo campo ("CC 12: 3400, CC 15: 890"). Valida cada par por separado y
 * devuelve el primer conflicto que encuentre.
 */
export const validarVisita = async ({ cc, horometro, fecha, ignorarId = null }) => {
  const h = String(horometro || "").trim();
  const ccStr = String(cc || "").trim();
  if (!h || h.toUpperCase() === "S/H" || !ccStr) return { ok: true };

  // cc suelto -> lectura suelta; o varios pares "CC n: valor".
  const pares = [];
  if (h.includes(":") || ccStr.includes(",")) {
    for (const m of h.matchAll(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi)) {
      pares.push({ cc: limpiarCC(m[1]), valor: m[2] });
    }
  } else {
    pares.push({ cc: limpiarCC(ccStr), valor: h });
  }
  if (pares.length === 0) return { ok: true };

  const tractores = await Tractor.find().select("cc").lean();
  const porCC = new Map(tractores.map((t) => [limpiarCC(t.cc), t]));

  for (const par of pares) {
    const tractor = porCC.get(par.cc);
    if (!tractor) continue; // un CC que no es tractor no se valida
    const chequeo = await validarLectura({
      tractor: tractor._id,
      fecha,
      horometro: par.valor,
      ignorarId,
    });
    if (!chequeo.ok) return { ...chequeo, cc: par.cc, tractor: tractor._id };
  }
  return { ok: true };
};

/**
 * Registra el reemplazo físico del horómetro. `horasAnterior` son las horas
 * que alcanzó a marcar el que sale de servicio.
 */
export const registrarCambio = async ({
  tractor,
  fecha,
  horasAnterior,
  lecturaInicial = 0,
  observaciones = "",
}) => {
  const horas = Number(horasAnterior);
  if (!tractor) throw new Error("Falta el tractor");
  if (!Number.isFinite(horas) || horas < 0) {
    throw new Error("Hay que indicar cuántas horas marcó el horómetro anterior");
  }

  const cambios = await cambiosDeTractor(tractor);
  const numero = cambios.length + 2; // el 1 es el horómetro de fábrica
  const baseAnterior = cambios.length ? cambios[cambios.length - 1].base : 0;

  return CambioHorometro.create({
    tractor,
    fecha: fecha ? new Date(aDia(fecha)) : new Date(),
    numero,
    horasAnterior: horas,
    base: Math.round((baseAnterior + horas) * 100) / 100,
    lecturaInicial: Number(lecturaInicial) || 0,
    observaciones,
  });
};
