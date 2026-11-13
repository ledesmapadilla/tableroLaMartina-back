/**
 * La vigencia de cada unión Citrusvil ↔ La Martina (12/11/2026).
 *
 * Al unir una tarea de Citrusvil con una de La Martina se elige si vale
 * "solo este mes" o "este mes y los que vienen". Cada unión guarda los meses
 * en que vale como rangos { desde, hasta } de claves de mes (AAAAMM, ej.
 * 202610); null es sin límite. Una unión sin rangos guardados (las de antes de
 * esto) vale siempre.
 *
 * La regla de todos los cambios: lo que se hace mirando un mes vale desde ese
 * mes en adelante; los meses anteriores no se tocan.
 */

export const MODOS_VIGENCIA = ["mes", "futuros"];

/** La clave del mes (202610), o null si no es un mes válido. */
export const mesClave = (anio, mes) => {
  const a = Number(anio);
  const m = Number(mes);
  if (!Number.isInteger(a) || !Number.isInteger(m) || m < 1 || m > 12 || a < 2000 || a > 2100) return null;
  return a * 100 + m;
};

const siguiente = (k) => (k % 100 === 12 ? (Math.floor(k / 100) + 1) * 100 + 1 : k + 1);
const anterior = (k) => (k % 100 === 1 ? (Math.floor(k / 100) - 1) * 100 + 12 : k - 1);

const cubre = (r, k) => (r.desde == null || r.desde <= k) && (r.hasta == null || r.hasta >= k);
const esSiempre = (rangos) => rangos.length === 1 && rangos[0].desde == null && rangos[0].hasta == null;

/** Los rangos de la unión `nombre` en esa equivalencia ([] si no está unida). */
export const rangosDe = (eq, nombre) => {
  if (!(eq?.citrusvil || []).includes(nombre)) return [];
  const v = (eq.vigencias || []).find((x) => x.citrusvil === nombre);
  return v?.rangos?.length ? v.rangos.map((r) => ({ desde: r.desde ?? null, hasta: r.hasta ?? null })) : [{ desde: null, hasta: null }];
};

/**
 * Cómo está la unión en el mes k: null si no vale ese mes, "mes" si vale
 * solo hasta ese mes y "futuros" si sigue después. `hasta` es el último mes
 * en que vale (null: sin límite).
 */
export const estadoEn = (eq, nombre, k) => {
  const r = rangosDe(eq, nombre).find((x) => cubre(x, k));
  if (!r) return null;
  return { modo: r.hasta === k ? "mes" : "futuros", hasta: r.hasta };
};

/**
 * Los rangos después de decidir, mirando el mes k, que desde ahí la unión
 * vale solo ese mes ("mes"), ese y los que vienen ("futuros") o ninguno
 * (null). Lo de antes de k queda igual.
 */
const desdeMes = (rangos, k, modo) => {
  const out = [];
  for (const r of rangos) {
    if (r.desde != null && r.desde >= k) continue;
    out.push(r.hasta == null || r.hasta >= k ? { desde: r.desde, hasta: anterior(k) } : r);
  }
  if (modo) out.push({ desde: k, hasta: modo === "mes" ? k : null });
  // Los rangos pegados se juntan en uno.
  out.sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0));
  const juntos = [];
  for (const r of out) {
    const ult = juntos[juntos.length - 1];
    if (ult && ult.hasta != null && siguiente(ult.hasta) === r.desde) ult.hasta = r.hasta;
    else juntos.push({ ...r });
  }
  return juntos;
};

/**
 * La equivalencia ({ citrusvil, vigencias }) después de decidir la unión con
 * `nombre` desde el mes k. `citrusvil` sigue siendo la lista de todas las que
 * están unidas en algún mes: la usan los controles de borrar y de unidades.
 */
export const conUnion = (eq, nombre, k, modo) => {
  const rangos = desdeMes(rangosDe(eq, nombre), k, modo);
  const citrusvil = (eq?.citrusvil || []).filter((c) => c !== nombre);
  const vigencias = (eq?.vigencias || []).filter((v) => v.citrusvil !== nombre);
  if (rangos.length) {
    citrusvil.push(nombre);
    if (!esSiempre(rangos)) vigencias.push({ citrusvil: nombre, rangos });
  }
  return { citrusvil, vigencias };
};

/**
 * La equivalencia como se ve en el mes k: solo las de Citrusvil que valen ese
 * mes, con su vigencia ({ nombre: "mes" | "futuros" }) y hasta cuándo.
 */
export const vistaDelMes = (eq, k) => {
  const citrusvil = [];
  const vigencia = {};
  const hasta = {};
  for (const c of eq.citrusvil || []) {
    const e = estadoEn(eq, c, k);
    if (!e) continue;
    citrusvil.push(c);
    vigencia[c] = e.modo;
    if (e.hasta != null) hasta[c] = e.hasta;
  }
  return { _id: eq._id, tarea: eq.tarea, citrusvil, observaciones: eq.observaciones, vigencia, hasta };
};
