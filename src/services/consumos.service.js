import ParteDiario from "../models/ParteDiario.js";

// El consumo de gasoil "entre cargas" (27/09/2026).
//
// Lo que se anota en el parte es el gasoil CARGADO, no el consumido: un día
// se llena el tanque y otro no se carga nada. En los dos talleres se carga a
// tanque lleno, así que cada carga repone exactamente lo que la máquina gastó
// desde la carga anterior. Con eso:
//
// - Un TRAMO va de una carga a la siguiente. La carga se hace al empezar el
//   día: la del día D cierra el tramo que arrancó el día de la carga anterior
//   (inclusive) y terminó el día antes de D. El día D abre el tramo nuevo.
// - Consumo del tramo = litros de la carga que lo cierra / horas del tramo.
// - Los litros del tramo se reparten entre sus partes en proporción a las
//   horas: es el gasoil consumido estimado de cada uno.
// - Un tramo sin carga que lo cierre todavía está ABIERTO, y lo trabajado
//   antes de la primera carga conocida no tiene INICIO: en los dos casos no
//   se sabe el consumo y esos partes no cuentan.
//
// Cada máquina se sigue por separado, sin importar el campo en el que
// trabaje: el CC con su `combustible`, y el turbo (por su código) con su
// `combTurbo` y las horas del CC con el que trabajó.

const DIA_MS = 24 * 60 * 60 * 1000;
// Cuánto historial se mira antes del período para encontrar la carga que abre
// el primer tramo.
const HISTORIAL_DIAS = 120;

const aDia = (fecha) => new Date(fecha).toISOString().slice(0, 10);
const redondear = (v) => Math.round(v * 100) / 100;

// Arma los tramos de una máquina a partir de sus partes y devuelve, por id de
// parte, lo que le toca.
const tramosDeMaquina = (partes, litrosDe) => {
  // Por día: los partes, sus horas y lo que se cargó.
  const dias = new Map();
  for (const p of partes) {
    const d = aDia(p.fecha);
    if (!dias.has(d)) dias.set(d, { dia: d, partes: [], horas: 0, horasCC: 0, carga: 0 });
    const x = dias.get(d);
    x.partes.push(p);
    x.horas += Number(p.totalHoras) || 0;
    x.horasCC += Number(p.horasCC) || 0;
    x.carga += Number(litrosDe(p)) || 0;
  }

  const resultado = new Map();
  const marcar = (dia, estado) => dia.partes.forEach((p) => resultado.set(String(p._id), estado));

  let tramo = null; // días del tramo en curso; null = antes de la primera carga
  for (const dia of [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia))) {
    if (dia.carga > 0) {
      if (tramo) {
        const horas = tramo.reduce((a, d) => a + d.horas, 0);
        const horasCC = tramo.reduce((a, d) => a + d.horasCC, 0);
        const datos = {
          desde: tramo[0].dia,
          hasta: tramo[tramo.length - 1].dia,
          carga: { dia: dia.dia, litros: redondear(dia.carga) },
          horas: redondear(horas),
          horasCC: redondear(horasCC),
          tasa: horas > 0 ? dia.carga / horas : null,
          tasaCC: horasCC > 0 ? dia.carga / horasCC : null,
        };
        for (const d of tramo) {
          for (const p of d.partes) {
            const h = Number(p.totalHoras) || 0;
            resultado.set(String(p._id), {
              estado: horas > 0 ? "cerrado" : "sinHoras",
              // El gasoil consumido estimado de este parte.
              litros: horas > 0 ? redondear((dia.carga * h) / horas) : 0,
              tramo: datos,
            });
          }
        }
      }
      // La carga abre el tramo siguiente, y ese día ya es parte de él.
      tramo = [dia];
    } else if (tramo) {
      tramo.push(dia);
    } else {
      marcar(dia, { estado: "sinInicio" });
    }
  }
  // El último tramo, sin carga que lo cierre todavía.
  (tramo || []).forEach((d) => marcar(d, { estado: "abierto", desde: tramo[0].dia }));

  return resultado;
};

/**
 * El consumo entre cargas de una lista de partes (los de un período). Mira
 * todo el historial de sus máquinas alrededor del período, en cualquier
 * campo. Devuelve { [idParte]: { cc, turbo } }, cada uno con `estado`
 * ("cerrado", "abierto", "sinInicio", "sinHoras") y, si está cerrado, los
 * `litros` consumidos estimados del parte y los datos de su `tramo`.
 */
export const consumosDePartes = async (objetivo) => {
  const conMaquina = objetivo.filter((p) => !p.pagoDe && (p.cc || (p.turbo || "").trim()));
  if (!conMaquina.length) return {};

  const ccs = [...new Set(conMaquina.filter((p) => p.cc).map((p) => String(p.cc)))];
  const turbos = [...new Set(conMaquina.map((p) => (p.turbo || "").trim()).filter(Boolean))];
  const primera = Math.min(...conMaquina.map((p) => new Date(p.fecha).getTime()));

  const historial = await ParteDiario.find({
    pagoDe: null,
    // Los provisorios no cuentan: su gasoil y sus horas todavía no son reales.
    provisorio: { $ne: true },
    fecha: { $gte: new Date(primera - HISTORIAL_DIAS * DIA_MS) },
    $or: [{ cc: { $in: ccs } }, { turbo: { $in: turbos } }],
  })
    .select("fecha cc turbo totalHoras horasCC combustible combTurbo")
    .lean();

  const porCC = new Map();
  const porTurbo = new Map();
  for (const p of historial) {
    if (p.cc) {
      const k = String(p.cc);
      if (!porCC.has(k)) porCC.set(k, []);
      porCC.get(k).push(p);
    }
    const t = (p.turbo || "").trim();
    if (t) {
      if (!porTurbo.has(t)) porTurbo.set(t, []);
      porTurbo.get(t).push(p);
    }
  }

  const deCC = new Map();
  for (const lista of porCC.values()) {
    tramosDeMaquina(lista, (p) => p.combustible).forEach((v, k) => deCC.set(k, v));
  }
  const deTurbo = new Map();
  for (const lista of porTurbo.values()) {
    tramosDeMaquina(lista, (p) => p.combTurbo).forEach((v, k) => deTurbo.set(k, v));
  }

  const salida = {};
  for (const p of conMaquina) {
    const id = String(p._id);
    salida[id] = {
      cc: p.cc ? deCC.get(id) || { estado: "sinInicio" } : null,
      turbo: (p.turbo || "").trim() ? deTurbo.get(id) || { estado: "sinInicio" } : null,
    };
  }
  return salida;
};
