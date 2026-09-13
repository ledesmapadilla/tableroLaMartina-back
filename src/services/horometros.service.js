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
import PeriodoCertificado from "../models/PeriodoCertificado.js";

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

/**
 * Los pares { cc, valor } que anota una visita, en todos los formatos en que
 * puede venir el horómetro (texto libre):
 *   - un CC y el valor suelto: cc "160", horómetro "395" o "395 hs";
 *   - pares cc:valor, uno o varios: "160: 405 hs, 1104: 9470 hs" (es lo que
 *     arma el formulario de Visitas; no hace falta que el CC esté en `cc`);
 *   - varios CC con los valores por posición: cc "160, 165", horómetro
 *     "330, 1409" (cargas viejas; así lo lee también la tabla de Preventivo).
 * "S/H" o vacío no es lectura, y un solo valor para varios CC no se puede
 * repartir: en esos casos no hay pares.
 */
export const paresDeVisita = (visita) => {
  const h = String(visita?.horometro || "").trim();
  if (!h || h.toUpperCase() === "S/H") return [];

  if (h.includes(":")) {
    return [...h.matchAll(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi)].map((m) => ({
      cc: limpiarCC(m[1]),
      valor: m[2],
    }));
  }

  const ccs = String(visita?.cc || "").split(/[,;]+/).map(limpiarCC).filter(Boolean);
  if (ccs.length === 1) return [{ cc: ccs[0], valor: h }];
  const valores = h.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return ccs.length > 1 && valores.length === ccs.length
    ? ccs.map((cc, i) => ({ cc, valor: valores[i] }))
    : [];
};

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

// Una lectura suelta en el formato común, o null si el valor no es un número.
const nuevaLectura = (fecha, valor, fuente, id, campo = null) => {
  const n = parsearHorometro(valor);
  if (n === null) return null;
  return {
    fecha: aDia(fecha),
    horometro: n,
    fuente,
    id: String(id),
    campo,
    clave: campo ? `${id}:${campo}` : String(id),
  };
};

/**
 * Las lecturas del tractor tomadas en visitas. Las visitas guardan el CC como
 * texto y pueden traer varios en un campo ("CC 12: 3400, CC 15: 890"): hay que
 * recorrerlas todas y quedarse con los pares de este tractor. Cada lectura
 * trae además el grupo y las observaciones de la visita, para el historial.
 */
export const lecturasDeVisitas = async (tractor) => {
  const cc = limpiarCC(tractor?.cc);
  if (!cc) return [];
  const visitas = await Visita.find({ horometro: { $exists: true, $ne: "" } })
    .select("fecha cc horometro grupo observaciones")
    .lean();

  const lecturas = [];
  const push = (v, valor) => {
    const l = nuevaLectura(v.fecha, valor, "visita", v._id);
    if (l) lecturas.push({ ...l, grupo: v.grupo || "", observaciones: v.observaciones || "" });
  };

  visitas.forEach((v) => {
    for (const par of paresDeVisita(v)) {
      if (par.cc === cc) push(v, par.valor);
    }
  });
  return lecturas;
};

/**
 * Todas las lecturas del tractor, de las cinco fuentes, como
 * { fecha, horometro, fuente, id, campo, clave }. Sin ordenar.
 *
 * Un parte trae dos lecturas en el mismo documento: `campo` dice cuál es y
 * `clave` las distingue cuando hay que tocar o ignorar solo una de ellas.
 */
export const lecturasDeTractor = async (tractorId, tractorPrecargado = null) => {
  // El que llama suele tener el tractor a mano (el parte llega con el CC y su
  // tractor ya poblados): releerlo es una consulta de más.
  const tractor = tractorPrecargado || (await Tractor.findById(tractorId).lean());
  if (!tractor) return [];
  const lecturas = [];

  const push = (...datos) => {
    const l = nuevaLectura(...datos);
    if (l) lecturas.push(l);
  };

  const [services, trabajos, manuales, centros, deVisitas] = await Promise.all([
    ServiceTractor.find({ tractor: tractorId }).select("fecha horometro").lean(),
    TrabajoTractor.find({ tractor: tractorId, horometro: { $nin: ["", null] } })
      .select("fecha horometro")
      .lean(),
    HorometroTractor.find({ tractor: tractorId }).select("fecha horometro origen").lean(),
    CentroCosto.find({ tractor: tractorId }).select("_id").lean(),
    lecturasDeVisitas(tractor),
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
      push(p.fecha, p.horomIngreso, "parte", p._id, "horomIngreso");
      push(p.fecha, p.horomSalida, "parte", p._id, "horomSalida");
    });
  }

  lecturas.push(...deVisitas);

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
 * Acepta un id o una lista de ids / claves (la corrección ignora todas las
 * copias de la lectura que está corrigiendo).
 * `contexto` (de `contextoDeHorometro`) evita releer el historial.
 */
export const ultimaLecturaAntesDe = async (tractorId, fecha, ignorarId = null, contexto = null) => {
  const dia = aDia(fecha);
  const { vigente, lecturas } = contexto || (await contextoDeHorometro(tractorId, fecha));
  const { desde } = vigente;
  const ignorar = new Set(
    (Array.isArray(ignorarId) ? ignorarId : [ignorarId]).filter(Boolean).map(String)
  );

  const previas = lecturas.filter(
    (l) =>
      l.fecha <= dia &&
      // Las lecturas del horómetro anterior no se comparan con las del nuevo.
      (!desde || l.fecha >= desde) &&
      !ignorar.has(l.id) &&
      !ignorar.has(l.clave)
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
  const pares = paresDeVisita({ cc, horometro });
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

// ── Corrección de una lectura anterior ────────────────────────────────

// Horas de la máquina en el centro de costo. El horómetro solo avanza, así
// que una salida menor que el ingreso es un error de carga: se deja en 0.
// Vive acá porque la usan el alta del parte y la corrección de su lectura.
export const calcularHorasCC = (ingreso, salida) => {
  const i = Number(ingreso);
  const s = Number(salida);
  if (!Number.isFinite(i) || !Number.isFinite(s) || s <= i) return 0;
  return Math.round((s - i) * 100) / 100;
};

const NUMERO = /[\d]+(?:[.,]\d+)?/;

// Cambia el número de un valor libre y deja el resto ("3400 hs" -> "340 hs").
const reemplazarNumero = (valor, nuevo) =>
  typeof valor === "number" ? nuevo : String(valor ?? "").replace(NUMERO, String(nuevo));

// La visita guarda el horómetro como texto y puede anotar varios tractores:
// solo se toca el par del tractor que se corrige.
// Los formatos son los de `paresDeVisita`.
export const corregirTextoVisita = (visita, cc, anterior, nuevo) => {
  const h = String(visita.horometro || "").trim();
  if (h.includes(":")) {
    return h.replace(/(?:CC\s*)?([0-9a-zA-Z\-_]+)\s*:\s*([^,;]+)/gi, (todo, c, valor) =>
      limpiarCC(c) === cc && parsearHorometro(valor) === anterior
        ? todo.slice(0, todo.length - valor.length) + reemplazarNumero(valor, nuevo)
        : todo
    );
  }

  const pares = paresDeVisita(visita);
  if (pares.length > 1) {
    // Valores por posición: se reescribe solo el que le toca al tractor.
    let i = -1;
    return h.replace(/[^,;]+/g, (parte) => {
      if (!parte.trim()) return parte;
      i += 1;
      return pares[i]?.cc === cc && parsearHorometro(parte) === anterior
        ? parte.replace(NUMERO, String(nuevo))
        : parte;
    });
  }
  return reemplazarNumero(h, nuevo);
};

const falla = (status, mensaje) => Object.assign(new Error(mensaje), { status });

// Un certificado cerrado queda congelado: la corrección no puede cambiarle
// los horómetros (ni las horas de CC) a un parte que ya se certificó. Se
// compara por día porque desde/hasta pueden venir con hora.
const partesCertificados = async (ids) => {
  if (!ids.length) return [];
  const partes = await ParteDiario.find({ _id: { $in: ids } })
    .select("fecha establecimiento")
    .lean();
  const cerrados = [];
  for (const p of partes) {
    const dia = aDia(p.fecha);
    const cerrado = await PeriodoCertificado.exists({
      establecimiento: p.establecimiento,
      cerrado: true,
      desde: { $lte: new Date(`${dia}T23:59:59.999Z`) },
      hasta: { $gte: new Date(`${dia}T00:00:00.000Z`) },
    });
    if (cerrado) cerrados.push(p);
  }
  return cerrados;
};

/**
 * Corrige una lectura ya registrada que estaba mal cargada (opción 4 del
 * aviso). La misma lectura suele figurar en varias fuentes: la reparación y
 * su copia en el historial, el parte y la suya. Se corrigen todas las del
 * tractor con ese valor en ese día, para que ninguna copia vieja siga
 * frenando la carga nueva.
 *
 * El valor corregido respeta la regla contra las lecturas anteriores a él.
 * Devuelve { ok: true, corregidas } o { ok: false, ...conflicto }.
 */
export const corregirLectura = async ({ tractor, fecha, valorAnterior, valorNuevo }) => {
  const anterior = Number(valorAnterior);
  const nuevo = Number(valorNuevo);
  if (!Number.isFinite(anterior)) throw falla(400, "Falta la lectura a corregir");
  if (!Number.isFinite(nuevo) || nuevo < 0) throw falla(400, "Indique el valor correcto");

  const tractorDoc = await Tractor.findById(tractor).lean();
  if (!tractorDoc) throw falla(404, "Tractor no encontrado");

  const dia = aDia(fecha);
  const lecturas = await lecturasDeTractor(tractor, tractorDoc);
  const objetivo = lecturas.filter((l) => l.fecha === dia && l.horometro === anterior);
  if (!objetivo.length) {
    throw falla(404, `No se encontró la lectura ${anterior} del ${dia} para corregir`);
  }

  const idsPartes = [...new Set(objetivo.filter((l) => l.fuente === "parte").map((l) => l.id))];
  const certificados = await partesCertificados(idsPartes);
  if (certificados.length) {
    throw falla(
      409,
      `La lectura está en un parte del ${aDia(certificados[0].fecha)} que pertenece a un ` +
        "certificado cerrado. Hay que reabrir el certificado para corregirla."
    );
  }

  const chequeo = await validarLectura({
    tractor,
    fecha: dia,
    horometro: nuevo,
    ignorarId: objetivo.map((l) => l.clave),
    contexto: { vigente: await horometroVigente(tractor, dia), lecturas },
  });
  if (!chequeo.ok) return chequeo;

  const cc = limpiarCC(tractorDoc.cc);
  const hechos = new Set();
  for (const l of objetivo) {
    // Un parte puede traer ingreso y salida con el mismo valor, y una visita
    // varias veces el mismo tractor: cada documento se reescribe una vez.
    if (hechos.has(l.id)) continue;
    hechos.add(l.id);

    if (l.fuente === "service") {
      await ServiceTractor.updateOne({ _id: l.id }, { $set: { horometro: nuevo } });
    } else if (l.fuente === "reparacion") {
      const t = await TrabajoTractor.findById(l.id).select("horometro").lean();
      await TrabajoTractor.updateOne(
        { _id: l.id },
        { $set: { horometro: reemplazarNumero(t?.horometro, nuevo) } }
      );
    } else if (l.fuente.startsWith("horometro:")) {
      await HorometroTractor.updateOne({ _id: l.id }, { $set: { horometro: nuevo } });
    } else if (l.fuente === "parte") {
      const p = await ParteDiario.findById(l.id).select("horomIngreso horomSalida").lean();
      const campos = objetivo.filter((o) => o.id === l.id).map((o) => o.campo);
      const cambios = Object.fromEntries(campos.map((c) => [c, nuevo]));
      const ingreso = cambios.horomIngreso ?? p.horomIngreso;
      const salida = cambios.horomSalida ?? p.horomSalida;
      await ParteDiario.updateOne(
        { _id: l.id },
        { $set: { ...cambios, horasCC: calcularHorasCC(ingreso, salida) } }
      );
    } else if (l.fuente === "visita") {
      const v = await Visita.findById(l.id).select("cc horometro").lean();
      await Visita.updateOne(
        { _id: l.id },
        { $set: { horometro: corregirTextoVisita(v, cc, anterior, nuevo) } }
      );
    }
  }

  return {
    ok: true,
    corregidas: objetivo.map(({ fuente, id, campo, fecha: f }) => ({ fuente, id, campo, fecha: f })),
  };
};
