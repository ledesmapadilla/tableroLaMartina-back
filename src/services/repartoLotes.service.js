import ParteDiario from "../models/ParteDiario.js";
import Lote from "../models/Lote.js";
import Tarea from "../models/Tarea.js";
import PeriodoCertificado from "../models/PeriodoCertificado.js";

// El pago por lote terminado (18/09/2026).
//
// En San Pablo el herbicida y el desmalezado no se pagan por
// jornada: se pagan cuando el lote queda terminado. Lo que se reparte es la
// medida del lote —las plantas o las hectáreas, según la unidad de la tarea—
// entre las jornadas que se le dedicaron, en proporción a las horas de cada
// una. El círculo verde de la planilla marca ese momento.
//
// El reparto se escribe en la `cantidad` de cada parte en vez de calcularse al
// vuelo: así el número queda congelado, Contable - Pagos no se toca y se puede
// auditar. `repartido` dice cuáles escribió el sistema, para no pisar ni
// borrar una cantidad que cargó una persona.
//
// Todo se cobra en la certificación en la que se termina el lote (25/09/2026).
// Una jornada de un mes anterior cuenta para el reparto pero se queda en su
// mes sin cantidad: lo suyo se paga con un renglón de pago (`pagoDe`) en la
// certificación del cierre.

// Las tareas que se pagan por lote terminado. Son las mismas que llevan el
// círculo de estado en la planilla (`tareasConEstado` en el front). El
// pulverizado salió el 25/09/2026: se carga con la cantidad a mano. La
// fertilización entró el 07/10/2026 (en plantas, como el herbicida).
export const TAREAS_POR_LOTE = ["herbicida", "desmalezado", "fertilizacion"];

// Lo que se escribe en el parte que se mueve de mes. Sirve de marca: al
// deshacer el reparto solo se limpian los períodos que puso el sistema.
export const MOTIVO_REPARTO = "Pago por lote terminado";

const CLAVE_PERIODO = /^\d{4}-\d{2}$/;

const sinAcentos = (t) =>
  (t || "").toString().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

// Dos nombres de lote son el mismo si coinciden sus letras y números: "L 12",
// "l12" y "L-12" son el mismo lote. Es la misma regla del padrón.
const comparable = (valor) => sinAcentos(valor).replace(/[^a-z0-9]/g, "");

const clavePeriodo = (anio, mes) => `${anio}-${String(mes).padStart(2, "0")}`;

// La medida que reparte una tarea, según su unidad. Las tareas en Tancadas
// (casi todos los pulverizados) quedan afuera: esas se cargan a mano.
const medidaDelLote = (unidad, lote) => {
  const u = sinAcentos(unidad);
  if (u.startsWith("planta")) return lote.plantas;
  if (u.startsWith("hectarea") || u === "ha") return lote.hectareas;
  return null;
};

/**
 * El desmalezado tiene que ir con la unidad en la que está medido el lote
 * (regla del usuario, 23/09/2026): un lote en hectáreas se desmaleza "x Ha" y
 * no "Mecánico", y uno en plantas al revés. Si no coinciden, el reparto no
 * tendría qué medida repartir. Un lote sin medida o fuera del padrón no se
 * controla. Devuelve el mensaje de error o null.
 */
export const desmalezadoFueraDeUnidad = async ({ establecimiento, lote }, tareaDelPadron) => {
  if (!tareaDelPadron || !sinAcentos(tareaDelPadron.tarea).includes("desmalezado")) return null;
  const buscado = comparable(lote);
  if (!buscado) return null;

  const lotes = await Lote.find({ establecimiento }).select("nombre hectareas plantas").lean();
  const delPadron = lotes.find((l) => comparable(l.nombre) === buscado);
  if (!delPadron) return null;

  const enHectareas = delPadron.hectareas != null && delPadron.plantas == null;
  const enPlantas = delPadron.plantas != null && delPadron.hectareas == null;
  const unidad = sinAcentos(tareaDelPadron.unidad);
  const tareaEnHectareas = unidad.startsWith("hectarea") || unidad === "ha";
  const tareaEnPlantas = unidad.startsWith("planta");

  if (enHectareas && tareaEnPlantas) {
    return (
      `El lote "${delPadron.nombre}" está medido en hectáreas: ` +
      `no va "${tareaDelPadron.tarea}", va el desmalezado x Ha.`
    );
  }
  if (enPlantas && tareaEnHectareas) {
    return (
      `El lote "${delPadron.nombre}" está medido en plantas: ` +
      `no va "${tareaDelPadron.tarea}", va el desmalezado mecánico.`
    );
  }
  return null;
};

export const esTareaDeLote = (nombre) => {
  const n = sinAcentos(nombre);
  return TAREAS_POR_LOTE.some((t) => n.includes(t));
};

/**
 * Los lotes de un parte, cada uno con su estado y lo que le tocó del reparto.
 * Un parte de varios lotes (07/10/2026) los trae en `lotes`; uno común tiene
 * su único lote en `lote`, y lo repartido es su `cantidad`.
 */
export const lotesDelParte = (p) => {
  if (Array.isArray(p?.lotes) && p.lotes.length) return p.lotes;
  if (!comparable(p?.lote)) return [];
  return [{ lote: p.lote, terminado: Boolean(p.terminado), cantidad: p.repartido ? p.cantidad : null }];
};

const esDeVariosLotes = (p) => Array.isArray(p?.lotes) && p.lotes.length > 0;

// Escribe lo que le tocó a un lote de un parte de varios lotes y rehace la
// cantidad del parte, que es la suma de lo repartido en todos. Va en una sola
// escritura (pipeline) para que dos lotes del mismo parte no se pisen.
const LOTES_CON_CANTIDAD = {
  $filter: { input: "$lotes", cond: { $ne: [{ $ifNull: ["$$this.cantidad", null] }, null] } },
};
const escribirEnLote = (id, indice, cantidad) => ({
  updateOne: {
    filter: { _id: id },
    update: [
      {
        $set: {
          lotes: {
            $map: {
              input: { $range: [0, { $size: "$lotes" }] },
              as: "i",
              in: {
                $cond: [
                  { $eq: ["$$i", indice] },
                  { $mergeObjects: [{ $arrayElemAt: ["$lotes", "$$i"] }, { cantidad }] },
                  { $arrayElemAt: ["$lotes", "$$i"] },
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          repartido: { $gt: [{ $size: LOTES_CON_CANTIDAD }, 0] },
          cantidad: {
            $cond: [
              { $gt: [{ $size: LOTES_CON_CANTIDAD }, 0] },
              { $round: [{ $sum: "$lotes.cantidad" }, 2] },
              null,
            ],
          },
        },
      },
    ],
  },
});

// Las escrituras del reparto: las de partes de un lote van por Mongoose y las
// de partes de varios lotes por el driver, porque Mongoose no deja mandar un
// pipeline sin más.
const escribir = async (ops) => {
  const comunes = ops.filter((o) => !o.varios);
  const varios = ops.filter((o) => o.varios).map((o) => o.varios);
  if (comunes.length) await ParteDiario.bulkWrite(comunes);
  if (varios.length) await ParteDiario.collection.bulkWrite(varios);
};

// Reparte la medida entre las jornadas, en proporción a las horas. Sin horas
// cargadas en ninguna se reparte en partes iguales: es lo único razonable y
// evita que un lote terminado no pague nada. El sobrante del redondeo se le
// suma a la última para que el total dé exacto.
//
// Las plantas van enteras (07/10/2026, pedido del usuario): no hay media
// planta. Ahí cada jornada se lleva la parte entera de lo suyo y las plantas
// que sobran van de a una a las que tenían la fracción más grande, así el total
// da justo y nadie gana o pierde más de una planta por el redondeo.
const repartir = (medida, jornadas, { enteros = false } = {}) => {
  const horas = jornadas.map((p) => Number(p.totalHoras) || 0);
  const total = horas.reduce((a, b) => a + b, 0);
  const pesos = total > 0 ? horas.map((h) => h / total) : jornadas.map(() => 1 / jornadas.length);
  if (enteros) {
    const exactos = pesos.map((p) => medida * p);
    const valores = exactos.map(Math.floor);
    let sobran = Math.round(medida) - valores.reduce((a, b) => a + b, 0);
    const porFraccion = exactos
      .map((x, i) => ({ i, fraccion: x - Math.floor(x) }))
      .sort((a, b) => b.fraccion - a.fraccion || a.i - b.i);
    for (const { i } of porFraccion) {
      if (sobran <= 0) break;
      valores[i] += 1;
      sobran -= 1;
    }
    return valores;
  }
  const valores = pesos.map((p) => Math.round(medida * p * 100) / 100);
  const sobra = Math.round((medida - valores.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (valores.length) {
    const ultimo = valores.length - 1;
    valores[ultimo] = Math.round((valores[ultimo] + sobra) * 100) / 100;
  }
  return valores;
};

// A qué certificado pertenece una fecha. El mes no es el calendario: el corte
// lo define cada período (en abril los partes van del 26/03 al 25/04). Los
// períodos se leen una sola vez y se resuelven en memoria.
const buscarPeriodo = (periodos, fecha) => {
  const f = new Date(fecha).getTime();
  const p = periodos.find(
    (x) => new Date(x.desde).getTime() <= f && f <= new Date(x.hasta).getTime()
  );
  if (p) return clavePeriodo(p.anio, p.mes);
  // Un mes que todavía nadie abrió va por el corte por defecto: del 26 al 25.
  const d = new Date(fecha);
  let anio = d.getUTCFullYear();
  let mes = d.getUTCMonth() + 1;
  if (d.getUTCDate() > 25) {
    mes += 1;
    if (mes === 13) {
      mes = 1;
      anio += 1;
    }
  }
  return clavePeriodo(anio, mes);
};

// Los partes del lote y la tarea, en orden: las jornadas y, aparte, los
// renglones de pago que armó el reparto (`pagoDe`), que no son jornadas. El
// lote se guarda como texto en el parte (los partes viejos no tienen padrón),
// así que se filtra en memoria por nombre comparable.
//
// Un parte de varios lotes entra con lo de este lote: su estado, lo que le
// tocó (`cantidadDelLote`), en qué lugar de `lotes` está (`indice`) y los
// otros lotes del día (`delDia`), que sirven para dividir sus horas.
const partesDelLote = async ({ establecimiento, tarea, lote }) => {
  const partes = await ParteDiario.find({ establecimiento, tarea })
    .select(
      "fecha createdAt persona cliente totalHoras lote lotes terminado cantidad repartido " +
        "periodo motivoFueraDeCierre pagoDe"
    )
    .sort({ fecha: 1, createdAt: 1 })
    .lean();
  const buscado = comparable(lote);
  const delLote = [];
  for (const p of partes) {
    if (!esDeVariosLotes(p)) {
      if (comparable(p.lote) === buscado) delLote.push(p);
      continue;
    }
    const indice = p.lotes.findIndex((l) => comparable(l.lote) === buscado);
    if (indice < 0) continue;
    const delDia = p.lotes;
    delLote.push({
      ...p,
      varios: true,
      indice,
      delDia,
      terminado: Boolean(delDia[indice].terminado),
      cantidadDelLote: delDia[indice].cantidad ?? null,
    });
  }
  return {
    lista: delLote.filter((p) => !p.pagoDe),
    pagos: delLote.filter((p) => p.pagoDe),
  };
};

/**
 * La parte de las horas del día que le toca al lote en un parte de varios
 * lotes (07/10/2026): según la medida de cada lote —plantas o hectáreas, la
 * unidad de la tarea—, así un lote del doble de plantas se lleva el doble de
 * horas. Si a alguno le falta la medida, en partes iguales. En un parte de un
 * solo lote es 1.
 */
const fraccionDelLote = (p, unidad, padron) => {
  if (!p.varios) return 1;
  const medidas = p.delDia.map((l) => {
    const delPadron = padron.find((x) => comparable(x.nombre) === comparable(l.lote));
    const m = delPadron ? Number(medidaDelLote(unidad, delPadron)) : NaN;
    return Number.isFinite(m) && m > 0 ? m : null;
  });
  if (medidas.some((m) => m === null)) return 1 / p.delDia.length;
  const total = medidas.reduce((a, b) => a + b, 0);
  return medidas[p.indice] / total;
};

// "DD/MM/AAAA", para la observación del renglón de pago.
const fechaCorta = (fecha) => {
  const [a, m, d] = new Date(fecha).toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

// El día de un parte, como "AAAA-MM-DD".
const dia = (fecha) => new Date(fecha).toISOString().slice(0, 10);

/**
 * El grupo que se paga junto: el lote y la tarea desde el cierre anterior
 * hasta el cierre que lo termina. Una segunda pasada más adelante en el año es
 * un grupo nuevo.
 *
 * El corte es **por día**, no por parte: el mismo lote y la misma tarea los
 * pueden dar por terminados dos personas distintas, cada una en su parte, y
 * eso sigue siendo un solo cierre (18/09/2026). Todas las jornadas del día del
 * cierre entran en el grupo, las hayan marcado o no y sin importar en qué
 * orden se cargaron.
 *
 * `cierre` en null quiere decir que el grupo sigue abierto.
 */
const grupoDe = (lista, diaDelParte) => {
  // El cierre del grupo: el primer día terminado del día del parte en adelante.
  const cierre = lista.find((p) => p.terminado && dia(p.fecha) >= diaDelParte) || null;
  const hasta = cierre ? dia(cierre.fecha) : null;

  // El cierre anterior: el último día terminado antes de ese.
  const previos = lista.filter((p) => p.terminado && (hasta === null || dia(p.fecha) < hasta));
  const desde = previos.length ? dia(previos[previos.length - 1].fecha) : null;

  const jornadas = lista.filter((p) => {
    const d = dia(p.fecha);
    if (desde !== null && d <= desde) return false;
    return hasta === null || d <= hasta;
  });
  return { jornadas, cierre };
};

// Borra el reparto de las jornadas que lo tengan: la cantidad vuelve a estar
// vacía y el parte vuelve al mes en el que cae su fecha. En un parte de varios
// lotes se borra solo lo de este lote.
const limpiar = (jornadas) =>
  jornadas
    .filter((p) => (p.varios ? p.cantidadDelLote !== null : p.repartido))
    .map((p) =>
      p.varios
        ? { varios: escribirEnLote(p._id, p.indice, null) }
        : {
            updateOne: {
              filter: { _id: p._id },
              update: {
                cantidad: null,
                repartido: false,
                ...(p.motivoFueraDeCierre === MOTIVO_REPARTO
                  ? { periodo: null, motivoFueraDeCierre: "" }
                  : {}),
              },
            },
          }
    );

// Los renglones de pago de un grupo: los de sus jornadas y los del día del
// cierre. Los segundos cubren el que quedó huérfano porque su jornada se borró
// o se pasó a otro lote.
const pagosDelGrupo = (pagos, jornadas, cierre) => {
  const ids = new Set(jornadas.map((p) => String(p._id)));
  const hasta = cierre ? dia(cierre.fecha) : null;
  return pagos.filter((p) => ids.has(String(p.pagoDe)) || (hasta !== null && dia(p.fecha) === hasta));
};

const borrarPagos = (pagos) =>
  pagos.map((p) => ({ deleteOne: { filter: { _id: p._id } } }));

const limpiarGrupo = async (jornadas, pagos, resto = {}) => {
  const ops = [...limpiar(jornadas), ...borrarPagos(pagos)];
  if (ops.length) await escribir(ops);
  return { estado: ops.length ? "limpiado" : "nada", ...resto };
};

/**
 * Rehace el pago del grupo al que pertenece un parte. Se llama cada vez que
 * algo del grupo puede haber cambiado: al marcar o desmarcar el círculo y al
 * cargar, editar o borrar una jornada.
 *
 * Devuelve qué pasó para que la pantalla lo cuente: `estado` es "repartido",
 * "limpiado" o "nada", y el reparto trae además el lote, la unidad, la medida,
 * cuántas jornadas la comparten y en qué mes se paga.
 */
export const recalcularLote = async ({
  establecimiento,
  tarea,
  lote,
  fecha,
  tareaDelPadron = null,
}) => {
  // Solo San Pablo paga por lote terminado. La guarda va primero de todo
  // porque esto corre en cada parte que se guarda: en Caspinchango, que es la
  // planilla grande, no tiene que costar ni una consulta.
  if (establecimiento !== "san-pablo") return { estado: "nada" };
  if (!tarea || !comparable(lote)) return { estado: "nada" };

  // La tarea suele venir ya leída por la validación de la cantidad: es una ida
  // y vuelta al cluster menos por parte guardado.
  const padron = tareaDelPadron || (await Tarea.findById(tarea).select("tarea unidad").lean());
  if (!padron || !esTareaDeLote(padron.tarea)) return { estado: "nada" };

  const { lista, pagos: todosLosPagos } = await partesDelLote({ establecimiento, tarea, lote });
  const { jornadas, cierre } = grupoDe(lista, dia(fecha));
  const pagos = pagosDelGrupo(todosLosPagos, jornadas, cierre);
  if (!jornadas.length) return limpiarGrupo([], pagos);

  // El grupo sigue abierto: si quedaba un reparto de antes, se borra.
  if (!cierre) return limpiarGrupo(jornadas, pagos);

  const lotes = await Lote.find({ establecimiento }).select("nombre hectareas plantas").lean();
  const loteDelPadron = lotes.find((l) => comparable(l.nombre) === comparable(lote));

  if (!loteDelPadron) {
    return limpiarGrupo(jornadas, pagos, {
      aviso: `El lote "${lote}" no está en el padrón: no se pudo repartir la medida.`,
    });
  }

  const medida = medidaDelLote(padron.unidad, loteDelPadron);
  if (medida === null || medida === undefined || !Number.isFinite(Number(medida))) {
    // En Tancadas no hay medida que repartir y no es un error: esas tareas se
    // siguen cargando a mano.
    if (medidaDelLote(padron.unidad, { plantas: 0, hectareas: 0 }) === null) {
      return limpiarGrupo(jornadas, pagos);
    }
    const falta = sinAcentos(padron.unidad).startsWith("planta") ? "las plantas" : "las hectáreas";
    return limpiarGrupo(jornadas, pagos, {
      aviso: `El lote "${loteDelPadron.nombre}" no tiene cargadas ${falta}: no se pudo repartir.`,
    });
  }

  const periodos = await PeriodoCertificado.find({ establecimiento })
    .select("anio mes desde hasta")
    .lean();
  // El lote entero se paga en la certificación en la que se termina.
  const mesDelPago = CLAVE_PERIODO.test(cierre.periodo || "")
    ? cierre.periodo
    : buscarPeriodo(periodos, cierre.fecha);

  // En qué certificación cae cada jornada. Un parte que alguien movió a mano,
  // con su propia explicación, va donde lo dejaron; el período que escribió un
  // reparto viejo no cuenta.
  const mesDe = (p) =>
    p.motivoFueraDeCierre &&
    p.motivoFueraDeCierre !== MOTIVO_REPARTO &&
    CLAVE_PERIODO.test(p.periodo || "")
      ? p.periodo
      : buscarPeriodo(periodos, p.fecha);

  // Todo se cobra en la certificación del cierre, y nada en las anteriores
  // (25/09/2026). La medida se reparte entre todas las jornadas del grupo, de
  // cualquier mes, en proporción a las horas: las de un mes anterior cuentan
  // para sacar la parte de cada uno. Pero esa jornada se queda en su mes, con
  // sus horas y sin cantidad, y lo que le toca se paga con un renglón de pago
  // (`pagoDe`) sin horas, fechado el día del cierre.
  //
  // En un parte de varios lotes cuenta solo la parte de sus horas que le toca
  // a este lote (07/10/2026, ver `fraccionDelLote`). Va sin redondear: las
  // horas redondeadas movían algunas plantas de una persona a otra. Redondeadas
  // se muestran solo en la observación del renglón de pago.
  const horasDelLote = (p) => (Number(p.totalHoras) || 0) * fraccionDelLote(p, padron.unidad, lotes);
  const valores = repartir(
    Number(medida),
    jornadas.map((p) => ({ totalHoras: horasDelLote(p) })),
    { enteros: sinAcentos(padron.unidad).startsWith("planta") }
  );
  const periodoDelPago = CLAVE_PERIODO.test(cierre.periodo || "") ? cierre.periodo : null;
  const pagoPorJornada = new Map(pagos.map((p) => [String(p.pagoDe), p]));
  const usados = new Set();
  let fueraDeMes = 0;

  const ops = jornadas.flatMap((p, i) => {
    if (mesDe(p) === mesDelPago) {
      if (p.varios) return [{ varios: escribirEnLote(p._id, p.indice, valores[i]) }];
      const cambios = { cantidad: valores[i], repartido: true };
      // Si un reparto viejo lo había mudado de mes, vuelve al de su fecha.
      if (p.motivoFueraDeCierre === MOTIVO_REPARTO) {
        cambios.periodo = null;
        cambios.motivoFueraDeCierre = "";
      }
      return [{ updateOne: { filter: { _id: p._id }, update: cambios } }];
    }

    fueraDeMes += 1;
    const datosDelPago = {
      fecha: cierre.fecha,
      persona: p.persona,
      // Sin cliente, el que se usa para pagarlo: Citrusvil.
      cliente: p.cliente || "Citrusvil",
      cantidad: valores[i],
      repartido: true,
      periodo: periodoDelPago,
      motivoFueraDeCierre: periodoDelPago ? MOTIVO_REPARTO : "",
      observacion:
        `${MOTIVO_REPARTO}: jornada del ${fechaCorta(p.fecha)} ` +
        `(${Math.round(horasDelLote(p) * 100) / 100} hs)`,
    };
    // El renglón va con el lote solo, también si la jornada fue de varios.
    const loteDelPago = p.varios ? p.delDia[p.indice].lote : p.lote;
    const existente = pagoPorJornada.get(String(p._id));
    const pago = existente
      ? { updateOne: { filter: { _id: existente._id }, update: datosDelPago } }
      : {
          insertOne: {
            document: { establecimiento, tarea, lote: loteDelPago, totalHoras: 0, pagoDe: p._id, ...datosDelPago },
          },
        };
    if (existente) usados.add(String(existente._id));
    return [...limpiar([p]), pago];
  });
  // Los renglones de pago que ya no le corresponden a ninguna jornada.
  ops.push(...borrarPagos(pagos.filter((p) => !usados.has(String(p._id)))));
  await escribir(ops);

  return {
    estado: "repartido",
    lote: loteDelPadron.nombre,
    tarea: padron.tarea,
    unidad: padron.unidad,
    medida: Number(medida),
    jornadas: jornadas.length,
    // Las jornadas de certificaciones anteriores, que cobran con un renglón de
    // pago en la del cierre.
    fueraDeMes,
    mes: mesDelPago,
  };
};

// Lo que `recalcularLote` necesita de un parte. Sirve igual para uno que se
// borró o que cambió de lote: el grupo se ubica por la fecha, no por el parte.
export const referenciaDeLote = (parte, { tareaDelPadron = null } = {}) => ({
  establecimiento: parte.establecimiento,
  tarea: parte.tarea?._id || parte.tarea,
  lote: parte.lote,
  fecha: parte.fecha,
  tareaDelPadron,
});

// Una referencia por cada lote del parte: el de varios lotes tiene que rehacer
// el grupo de cada uno (07/10/2026). Sin lote, ninguna.
export const referenciasDeLotes = (parte, opciones = {}) =>
  lotesDelParte(parte).map((l) => ({ ...referenciaDeLote(parte, opciones), lote: l.lote }));

/**
 * Rehace el reparto de varios grupos, de a uno: son pocos y así dos lotes del
 * mismo parte no se leen a la vez. Devuelve lo que la pantalla tiene que
 * contar: un aviso si hubo, si no un reparto hecho, si no uno deshecho.
 */
export const recalcularLotes = async (referencias, recalcular = recalcularLote) => {
  const resultados = [];
  for (const r of referencias) resultados.push(await recalcular(r));
  return (
    resultados.find((r) => r.aviso) ||
    resultados.find((r) => r.estado === "repartido") ||
    resultados.find((r) => r.estado === "limpiado") ||
    { estado: "nada" }
  );
};

/**
 * El último día en que se dio por terminado cada lote con cada tarea. La
 * planilla lo usa para avisar cuando alguien carga trabajo en un lote que ya
 * estaba terminado (18/09/2026): una segunda pasada es válida, pero al día
 * siguiente casi siempre es un error de carga.
 */
export const cierresDeLotes = async (establecimiento) => {
  if (establecimiento !== "san-pablo") return [];
  const terminados = await ParteDiario.find({ establecimiento, terminado: true })
    .select("fecha lote lotes terminado tarea")
    .sort({ fecha: 1 })
    .lean();

  // Uno por lote y tarea, con la fecha más nueva: es la que importa para
  // avisar. El lote se compara normalizado, pero se devuelve como se escribió.
  // En un parte de varios lotes cuentan solo los que se terminaron.
  const porGrupo = new Map();
  for (const p of terminados) {
    if (!p.tarea) continue;
    for (const l of lotesDelParte(p)) {
      if (!l.terminado || !comparable(l.lote)) continue;
      porGrupo.set(`${comparable(l.lote)}|${p.tarea}`, {
        lote: l.lote,
        tarea: String(p.tarea),
        fecha: dia(p.fecha),
      });
    }
  }
  return [...porGrupo.values()];
};
