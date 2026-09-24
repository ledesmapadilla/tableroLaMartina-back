import PeriodoCertificado from "../models/PeriodoCertificado.js";
import ParteDiario from "../models/ParteDiario.js";
import { CLAVES, POR_DEFECTO } from "../models/Establecimiento.js";
import { recalcularLote } from "../services/repartoLotes.service.js";

// El establecimiento llega por query. Sin el se asume Caspinchango, que es el
// unico que existia antes de separar los campos: asi los links viejos y las
// pantallas que todavia no lo mandan siguen andando.
const delRequest = (req) => {
  const clave = (req.query.establecimiento || "").trim();
  return CLAVES.includes(clave) ? clave : POR_DEFECTO;
};

const UN_DIA = 24 * 60 * 60 * 1000;

// Corte por defecto mientras nadie lo haya definido: del 26 del mes anterior
// al 25 de este. La fecha de cierre es el 25 (regla del usuario, 12/09/2026) y
// se puede editar; queda guardada. Rige también con el mes abierto: nada
// posterior al cierre entra en el certificado salvo que se lo deje con una
// explicación (ver `periodo` en ParteDiario).
const porDefecto = (anio, mes) => ({
  desde: new Date(Date.UTC(mes === 1 ? anio - 1 : anio, mes === 1 ? 11 : mes - 2, 26)),
  hasta: new Date(Date.UTC(anio, mes - 1, 25)),
});

// La certificación de un mes arranca el día siguiente al cierre del anterior:
// entre dos períodos no queda ningún día suelto ni ningún día repetido.
const diaSiguiente = (fecha) => new Date(new Date(fecha).getTime() + UN_DIA);

const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
const mesSiguiente = (anio, mes) => (mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 });

// El corte sugerido de un mes que todavía no se guardó. El "desde" sale del
// cierre del mes anterior, esté cerrado o no: su fecha de cierre ya es un
// corte real. El "hasta" es el 25 del mes.
const sugerido = (anio, mes, anterior) => {
  const base = porDefecto(anio, mes);
  if (!anterior?.hasta) return base;
  return { desde: diaSiguiente(anterior.hasta), hasta: base.hasta };
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const ddmmaaaa = (fecha) => new Date(fecha).toISOString().slice(0, 10).split("-").reverse().join("/");
const diaAnterior = (fecha) => new Date(new Date(fecha).getTime() - UN_DIA);
const mismoDia = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();

/**
 * Los días que cambian de mes cuando un corte pasa de `antes` a `despues`
 * (los dos son fechas de cierre). Null si el corte no se movió.
 */
const diasQueCambian = (antes, despues) => {
  if (mismoDia(antes, despues)) return null;
  const [a, b] = antes < despues ? [antes, despues] : [despues, antes];
  return { $gte: diaSiguiente(a), $lte: new Date(new Date(b).getTime() + UN_DIA - 1) };
};

// Los partes que caen en un mes por su fecha. Los que alguien dejó a mano en
// otro mes, con su explicación (`periodo`), no se mueven con el corte.
const partesPorFecha = (establecimiento, fecha) => ({
  establecimiento,
  fecha,
  periodo: { $in: [null, ""] },
});

/**
 * El pago por lote terminado guarda en cada jornada el mes en que se cobra
 * (`periodo` con MOTIVO_REPARTO), calculado con los cortes. Si un corte se
 * mueve, esos grupos se rehacen con los cortes nuevos. Solo San Pablo tiene
 * reparto; recalcularLote ya se corta en los otros campos.
 */
const rehacerRepartos = async (establecimiento, rangos) => {
  const fechas = rangos.filter(Boolean);
  if (establecimiento !== "san-pablo" || !fechas.length) return;
  const partes = await ParteDiario.find({
    establecimiento,
    repartido: true,
    $or: fechas.map((fecha) => ({ fecha })),
  })
    .select("tarea lote fecha")
    .lean();
  const hechos = new Set();
  for (const p of partes) {
    const clave = `${p.tarea}|${p.lote}|${p.fecha.toISOString()}`;
    if (hechos.has(clave)) continue;
    hechos.add(clave);
    await recalcularLote({ establecimiento, tarea: p.tarea, lote: p.lote, fecha: p.fecha });
  }
};


export const getPeriodo = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    if (!anio || !mes || mes < 1 || mes > 12) {
      return res.status(400).json({ error: "Año o mes inválido" });
    }

    const establecimiento = delRequest(req);
    const guardado = await PeriodoCertificado.findOne({ establecimiento, anio, mes });
    if (guardado) return res.json(guardado);

    // No se crea nada todavía: se devuelve el corte sugerido, que arranca donde
    // terminó el mes anterior.
    const previo = mesAnterior(anio, mes);
    const anterior = await PeriodoCertificado.findOne({ establecimiento, ...previo }).lean();
    res.json({
      establecimiento,
      anio,
      mes,
      ...sugerido(anio, mes, anterior),
      cerrado: false,
      fechaCierre: null,
      guardado: false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los 12 meses de un año: lo que esté guardado y, para los que nadie tocó
// todavía, el corte sugerido. La grilla de meses lo pide de una vez en lugar
// de hacer doce consultas.
export const getPeriodosDelAnio = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    if (!anio) return res.status(400).json({ error: "Año inválido" });

    const establecimiento = delRequest(req);
    const guardados = await PeriodoCertificado.find({ establecimiento, anio }).lean();
    const porMes = new Map(guardados.map((p) => [p.mes, p]));
    // Enero arranca donde cerró diciembre del año anterior, así que ese mes
    // también entra en la consulta.
    const diciembrePrevio = await PeriodoCertificado.findOne({
      establecimiento,
      anio: anio - 1,
      mes: 12,
    }).lean();

    // Los meses se recorren en orden porque cada uno mira el cierre del que
    // tiene atrás.
    let anterior = diciembrePrevio;
    const periodos = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const guardado = porMes.get(mes);
      const periodo = guardado
        ? { ...guardado, guardado: true }
        : {
            establecimiento,
            anio,
            mes,
            ...sugerido(anio, mes, anterior),
            cerrado: false,
            fechaCierre: null,
            guardado: false,
          };
      anterior = periodo;
      return periodo;
    });

    res.json(periodos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * Guarda el corte de un mes. Entre dos meses hay un solo corte (regla del
 * usuario, 23/09/2026): el inicio de un mes es siempre el día siguiente al
 * cierre del anterior. Por eso mover el inicio corre el cierre del mes
 * anterior, y mover el cierre corre el inicio del siguiente. No queda ningún
 * día sin mes ni ningún día en dos meses.
 *
 * Los partes van solos: cada uno cae en el mes que le toca por su fecha, así
 * que al moverse el corte los del medio pasan de un mes al otro. Los que
 * alguien dejó a mano en un mes con su explicación no se mueven, y los del
 * pago por lote terminado se rehacen con los cortes nuevos.
 *
 * Un vecino cerrado también se corre, aunque le saque o le meta partes (lo
 * pidió el usuario el 23/09/2026: la regla va primero). La respuesta lo
 * marca para que la pantalla lo avise.
 */
export const guardarPeriodo = async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    const { desde, hasta, cerrado, fechaCierre } = req.body;

    if (!desde || !hasta) {
      return res.status(400).json({ error: "Hay que indicar desde y hasta" });
    }
    if (new Date(desde) > new Date(hasta)) {
      return res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la de fin" });
    }

    // cerrado/fechaCierre solo se tocan si vienen en el body; guardar el
    // periodo desde la pantalla no debe reabrir un certificado ya cerrado.
    const establecimiento = delRequest(req);
    const cambios = { establecimiento, anio, mes, desde: new Date(desde), hasta: new Date(hasta) };
    if (cerrado !== undefined) {
      cambios.cerrado = Boolean(cerrado);
      cambios.fechaCierre = cerrado && fechaCierre ? new Date(fechaCierre) : null;
    }

    const previo = mesAnterior(anio, mes);
    const prox = mesSiguiente(anio, mes);
    const [actual, anterior, siguiente] = await Promise.all([
      PeriodoCertificado.findOne({ establecimiento, anio, mes }).lean(),
      PeriodoCertificado.findOne({ establecimiento, ...previo }),
      PeriodoCertificado.findOne({ establecimiento, ...prox }),
    ]);
    const esteMes = MESES[mes - 1];
    const mesPrevio = MESES[previo.mes - 1];
    const mesProx = MESES[prox.mes - 1];

    // ── el corte con el mes anterior ──
    const cierreAnterior = diaAnterior(cambios.desde);
    const cierreAnteriorViejo = anterior?.hasta || porDefecto(previo.anio, previo.mes).hasta;
    // Un anterior que nunca se guardó arranca donde lo encadena el suyo.
    const inicioAnterior =
      anterior?.desde ||
      sugerido(
        previo.anio,
        previo.mes,
        await PeriodoCertificado.findOne({ establecimiento, ...mesAnterior(previo.anio, previo.mes) }).lean()
      ).desde;
    if (cierreAnterior < inicioAnterior) {
      return res.status(400).json({
        error:
          `${mesPrevio[0].toUpperCase()}${mesPrevio.slice(1)} arranca el ${ddmmaaaa(inicioAnterior)}: ` +
          `el inicio de ${esteMes} tiene que ser posterior.`,
      });
    }
    const diasConElAnterior = diasQueCambian(cierreAnteriorViejo, cierreAnterior);

    // ── el corte con el mes siguiente ──
    const inicioSiguiente = diaSiguiente(cambios.hasta);
    const cierreSiguiente = siguiente?.hasta || porDefecto(prox.anio, prox.mes).hasta;
    if (inicioSiguiente > cierreSiguiente) {
      return res.status(400).json({
        error:
          `${mesProx[0].toUpperCase()}${mesProx.slice(1)} cierra el ${ddmmaaaa(cierreSiguiente)}: ` +
          `el cierre de ${esteMes} tiene que ser anterior.`,
      });
    }
    // Un siguiente sin guardar arranca, por el encadenado, después del cierre
    // que tenía este mes.
    const cierreViejo = siguiente
      ? diaAnterior(siguiente.desde)
      : actual?.hasta || porDefecto(anio, mes).hasta;
    const diasConElSiguiente = diasQueCambian(cierreViejo, cambios.hasta);

    const [movidosAnterior, movidosSiguiente] = await Promise.all(
      [diasConElAnterior, diasConElSiguiente].map((dias) =>
        dias ? ParteDiario.countDocuments(partesPorFecha(establecimiento, dias)) : 0
      )
    );

    const periodo = await PeriodoCertificado.findOneAndUpdate(
      { establecimiento, anio, mes },
      cambios,
      { new: true, upsert: true, runValidators: true }
    );

    let corrioAnterior = false;
    if (anterior && !mismoDia(anterior.hasta, cierreAnterior)) {
      anterior.hasta = cierreAnterior;
      await anterior.save();
      corrioAnterior = true;
    } else if (!anterior && !mismoDia(cierreAnteriorViejo, cierreAnterior)) {
      // El anterior nunca se guardó y su corte por defecto ya no sirve: se lo
      // guarda con el cierre que le toca.
      await PeriodoCertificado.create({
        establecimiento,
        ...previo,
        desde: inicioAnterior,
        hasta: cierreAnterior,
      });
      corrioAnterior = true;
    }

    let corrioSiguiente = false;
    if (siguiente && !mismoDia(siguiente.desde, inicioSiguiente)) {
      siguiente.desde = inicioSiguiente;
      await siguiente.save();
      corrioSiguiente = true;
    }

    // Los rangos viejos de este mismo mes también entran: si venía con un
    // corte desparejo, sus partes también cambian de mes.
    await rehacerRepartos(establecimiento, [
      diasConElAnterior,
      diasConElSiguiente,
      actual && diasQueCambian(diaAnterior(actual.desde), cierreAnterior),
      actual && diasQueCambian(actual.hasta, cambios.hasta),
    ]).catch((e) => console.error("No se pudo rehacer el pago por lote terminado:", e.message));

    // Lo que se corrió en los vecinos va en la respuesta para avisarlo en
    // pantalla; el resto es el período.
    res.json({
      ...periodo.toObject(),
      cierreAnterior: corrioAnterior ? cierreAnterior : null,
      inicioSiguiente: corrioSiguiente ? inicioSiguiente : null,
      anteriorCerrado: corrioAnterior && Boolean(anterior?.cerrado),
      siguienteCerrado: corrioSiguiente && Boolean(siguiente?.cerrado),
      partesMovidos: movidosAnterior + movidosSiguiente,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
