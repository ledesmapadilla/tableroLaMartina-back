import ParteDiario from "../models/ParteDiario.js";
import Lote from "../models/Lote.js";
import Tarea from "../models/Tarea.js";
import PeriodoCertificado from "../models/PeriodoCertificado.js";

// El pago por lote terminado (18/09/2026).
//
// En San Pablo el herbicida, el desmalezado y el pulverizado no se pagan por
// jornada: se pagan cuando el lote queda terminado. Lo que se reparte es la
// medida del lote —las plantas o las hectáreas, según la unidad de la tarea—
// entre las jornadas que se le dedicaron, en proporción a las horas de cada
// una. El círculo verde de la planilla marca ese momento.
//
// El reparto se escribe en la `cantidad` de cada parte en vez de calcularse al
// vuelo: así el número queda congelado, Contable - Pagos no se toca y se puede
// auditar. `repartido` dice cuáles escribió el sistema, para no pisar ni
// borrar una cantidad que cargó una persona.

// Las tareas que se pagan por lote terminado. Son las mismas que llevan el
// círculo de estado en la planilla (`tareasConEstado` en el front).
export const TAREAS_POR_LOTE = ["herbicida", "desmalezado", "pulverizado"];

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

const esTareaDeLote = (nombre) => {
  const n = sinAcentos(nombre);
  return TAREAS_POR_LOTE.some((t) => n.includes(t));
};

// Reparte la medida entre las jornadas, en proporción a las horas. Sin horas
// cargadas en ninguna se reparte en partes iguales: es lo único razonable y
// evita que un lote terminado no pague nada. El sobrante del redondeo se le
// suma a la última para que el total dé exacto.
const repartir = (medida, jornadas) => {
  const horas = jornadas.map((p) => Number(p.totalHoras) || 0);
  const total = horas.reduce((a, b) => a + b, 0);
  const pesos = total > 0 ? horas.map((h) => h / total) : jornadas.map(() => 1 / jornadas.length);
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

// Las jornadas del lote y la tarea, en orden. El lote se guarda como texto en
// el parte (los partes viejos no tienen padrón), así que se filtra en memoria
// por nombre comparable.
const jornadasDelLote = async ({ establecimiento, tarea, lote }) => {
  const partes = await ParteDiario.find({ establecimiento, tarea })
    .select(
      "fecha createdAt totalHoras lote terminado cantidad repartido periodo motivoFueraDeCierre"
    )
    .sort({ fecha: 1, createdAt: 1 })
    .lean();
  const buscado = comparable(lote);
  return partes.filter((p) => comparable(p.lote) === buscado);
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
// vacía y el parte vuelve al mes en el que cae su fecha.
const limpiar = (jornadas) =>
  jornadas
    .filter((p) => p.repartido)
    .map((p) => ({
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
    }));

const limpiarGrupo = async (jornadas, resto = {}) => {
  const ops = limpiar(jornadas);
  if (ops.length) await ParteDiario.bulkWrite(ops);
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

  const lista = await jornadasDelLote({ establecimiento, tarea, lote });
  if (!lista.length) return { estado: "nada" };

  const { jornadas, cierre } = grupoDe(lista, dia(fecha));
  if (!jornadas.length) return { estado: "nada" };

  // El grupo sigue abierto: si quedaba un reparto de antes, se borra.
  if (!cierre) return limpiarGrupo(jornadas);

  const lotes = await Lote.find({ establecimiento }).select("nombre hectareas plantas").lean();
  const loteDelPadron = lotes.find((l) => comparable(l.nombre) === comparable(lote));

  if (!loteDelPadron) {
    return limpiarGrupo(jornadas, {
      aviso: `El lote "${lote}" no está en el padrón: no se pudo repartir la medida.`,
    });
  }

  const medida = medidaDelLote(padron.unidad, loteDelPadron);
  if (medida === null || medida === undefined || !Number.isFinite(Number(medida))) {
    // En Tancadas no hay medida que repartir y no es un error: esas tareas se
    // siguen cargando a mano.
    if (medidaDelLote(padron.unidad, { plantas: 0, hectareas: 0 }) === null) {
      return limpiarGrupo(jornadas);
    }
    const falta = sinAcentos(padron.unidad).startsWith("planta") ? "las plantas" : "las hectáreas";
    return limpiarGrupo(jornadas, {
      aviso: `El lote "${loteDelPadron.nombre}" no tiene cargadas ${falta}: no se pudo repartir.`,
    });
  }

  const periodos = await PeriodoCertificado.find({ establecimiento })
    .select("anio mes desde hasta")
    .lean();
  // Se paga todo en el mes en que se termina el lote, aunque haya jornadas de
  // meses anteriores ya cerrados.
  const mesDelPago = CLAVE_PERIODO.test(cierre.periodo || "")
    ? cierre.periodo
    : buscarPeriodo(periodos, cierre.fecha);

  const valores = repartir(Number(medida), jornadas);
  const ops = jornadas.map((p, i) => {
    const cambios = { cantidad: valores[i], repartido: true };
    // El parte se muda al mes del cierre. Uno que alguien ya había movido a
    // mano, con su propia explicación, se deja donde está.
    const propio = !p.motivoFueraDeCierre || p.motivoFueraDeCierre === MOTIVO_REPARTO;
    if (propio) {
      const suyo = buscarPeriodo(periodos, p.fecha);
      if (suyo !== mesDelPago) {
        cambios.periodo = mesDelPago;
        cambios.motivoFueraDeCierre = MOTIVO_REPARTO;
      } else {
        cambios.periodo = null;
        cambios.motivoFueraDeCierre = "";
      }
    }
    return { updateOne: { filter: { _id: p._id }, update: cambios } };
  });
  await ParteDiario.bulkWrite(ops);

  return {
    estado: "repartido",
    lote: loteDelPadron.nombre,
    tarea: padron.tarea,
    unidad: padron.unidad,
    medida: Number(medida),
    jornadas: jornadas.length,
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

/**
 * El último día en que se dio por terminado cada lote con cada tarea. La
 * planilla lo usa para avisar cuando alguien carga trabajo en un lote que ya
 * estaba terminado (18/09/2026): una segunda pasada es válida, pero al día
 * siguiente casi siempre es un error de carga.
 */
export const cierresDeLotes = async (establecimiento) => {
  if (establecimiento !== "san-pablo") return [];
  const terminados = await ParteDiario.find({ establecimiento, terminado: true })
    .select("fecha lote tarea")
    .sort({ fecha: 1 })
    .lean();

  // Uno por lote y tarea, con la fecha más nueva: es la que importa para
  // avisar. El lote se compara normalizado, pero se devuelve como se escribió.
  const porGrupo = new Map();
  for (const p of terminados) {
    if (!comparable(p.lote) || !p.tarea) continue;
    porGrupo.set(`${comparable(p.lote)}|${p.tarea}`, {
      lote: p.lote,
      tarea: String(p.tarea),
      fecha: dia(p.fecha),
    });
  }
  return [...porGrupo.values()];
};
