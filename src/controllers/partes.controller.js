import mongoose from "mongoose";
import { clienteDelPadron, NO_ES_DEL_PADRON } from "./clientes.controller.js";
import { CLAVES, POR_DEFECTO } from "../models/Establecimiento.js";
import ParteDiario from "../models/ParteDiario.js";
import {
  registrarLecturaDeParte,
  borrarLecturaDeParte,
} from "./horometrostractor.controller.js";
import CentroCosto from "../models/CentroCosto.js";
import Tarea from "../models/Tarea.js";
import {
  recalcularLote,
  referenciaDeLote,
  cierresDeLotes,
  desmalezadoFueraDeUnidad,
} from "../services/repartoLotes.service.js";
import {
  validarLectura,
  contextoDeHorometro,
  ultimaLecturaAntesDe,
  parsearHorometro,
  calcularHorasCC,
} from "../services/horometros.service.js";
import { consumosDePartes } from "../services/consumos.service.js";

// El horómetro del parte es el del tractor: solo se valida si el CC lo es.
// Las dos lecturas son del mismo tractor y el mismo día, así que el historial
// se lee una sola vez para las dos: pedirlo por lectura era el grueso de lo
// que tardaba guardar un parte.
const chequearHorometroDelParte = async (body, centro, ignorarId = null) => {
  if (!centro?.tractor) return { ok: true };

  // Sin ninguna lectura cargada no hay nada que validar ni que consultar.
  const campos = ["horomIngreso", "horomSalida"].filter(
    (campo) => parsearHorometro(body[campo]) !== null
  );
  if (!campos.length) return { ok: true };

  const tractor = centro.tractor._id;
  const contexto = await contextoDeHorometro(tractor, body.fecha, centro.tractor);

  // Se valida la salida, que es la lectura con la que queda la máquina.
  for (const campo of campos) {
    const chequeo = await validarLectura({
      tractor,
      fecha: body.fecha,
      horometro: body[campo],
      ignorarId,
      contexto,
    });
    if (!chequeo.ok) return { ...chequeo, campo };
  }
  return { ok: true };
};

// "HH:mm" -> minutos desde la medianoche. Devuelve null si no es una hora.
// La edición deja el horómetro como estaba: mismas lecturas, mismo día y
// mismo CC.
const mismoHorometro = (anterior, body) =>
  Boolean(anterior) &&
  String(anterior.cc || "") === String(body.cc || "") &&
  (anterior.fecha ? new Date(anterior.fecha).toISOString().slice(0, 10) : "") ===
    String(body.fecha || "").slice(0, 10) &&
  parsearHorometro(anterior.horomIngreso) === parsearHorometro(body.horomIngreso) &&
  parsearHorometro(anterior.horomSalida) === parsearHorometro(body.horomSalida);

const aMinutos = (hora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

// Los minutos de un tramo. Si el egreso es anterior al ingreso el turno cruzó
// la medianoche (22:00 → 06:00 son 8 horas, no -16).
const minutosDelTramo = (horaIngreso, horaEgreso) => {
  const ingreso = aMinutos(horaIngreso);
  const egreso = aMinutos(horaEgreso);
  if (ingreso === null || egreso === null) return 0;
  return egreso >= ingreso ? egreso - ingreso : 1440 - ingreso + egreso;
};

// Único campo que no se carga a mano: la suma de los dos tramos del día. El
// segundo es el de San Pablo, que corta al mediodía; vacío no suma nada.
const calcularTotalHoras = (body) => {
  const minutos =
    minutosDelTramo(body.horaIngreso, body.horaEgreso) +
    minutosDelTramo(body.horaIngreso2, body.horaEgreso2);
  // Se redondea a 2 decimales: restando horas del reloj nunca hace falta más.
  return Math.round((minutos / 60) * 100) / 100;
};

// Los dos tramos del día no se pueden pisar: el segundo arranca cuando terminó
// el primero (San Pablo, 18/09/2026). Todo se mide desde la entrada del primer
// tramo, así la cuenta también vale para un turno que cruzó la medianoche.
//
// Con la salida del primer tramo sin cargar no hay nada que controlar: ese
// tramo todavía no dura nada.
export const tramosSeSolapan = (body) => {
  const inicio1 = aMinutos(body.horaIngreso);
  const inicio2 = aMinutos(body.horaIngreso2);
  if (inicio1 === null || inicio2 === null) return false;

  // El segundo tramo tampoco puede arrancar antes que el primero: eso es la
  // jornada cargada al revés. La única vez que vale es cuando el primero cruzó
  // la medianoche, porque ahí las 03:00 del segundo son más tarde que las
  // 22:00 del primero.
  const fin1 = aMinutos(body.horaEgreso);
  const cruzaMedianoche = fin1 !== null && fin1 < inicio1;
  if (!cruzaMedianoche && inicio2 < inicio1) return true;

  const dura1 = minutosDelTramo(body.horaIngreso, body.horaEgreso);
  // Cuánto después del primer tramo arranca el segundo.
  const despues = (inicio2 - inicio1 + 1440) % 1440;
  if (despues < dura1) return true;

  // Y no puede dar la vuelta al reloj y pisar al primero por el otro lado.
  return despues + minutosDelTramo(body.horaIngreso2, body.horaEgreso2) > 1440;
};

// "AAAA-MM-DD": el día de un parte.
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const sinCantidad = (body) =>
  body.cantidad === "" || body.cantidad === null || body.cantidad === undefined;

// En San Pablo el desmalezado y el herbicida se cargan sin cantidad
// (17/09/2026); las demás tareas la llevan, como en Caspinchango.
export const TAREAS_SIN_CANTIDAD = ["desmalezado", "herbicida"];

const sinAcentos = (t) =>
  (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// La tarea del padrón, leída una sola vez por parte guardado: la usan la
// validación de la cantidad y el pago por lote terminado. Solo hace falta en
// San Pablo, y solo cuando la cantidad viene vacía o el parte tiene lote: en
// Caspinchango, que es la planilla grande, guardar no paga esta consulta.
const buscarTareaDelParte = async (body) => {
  if (clave(body.establecimiento) !== "san-pablo") return null;
  if (!sinCantidad(body) && !(body.lote || "").trim()) return null;
  if (!mongoose.isValidObjectId(body.tarea)) return null;
  return Tarea.findById(body.tarea).select("tarea unidad").lean();
};

const faltaLaCantidad = (body, tareaDelPadron) => {
  if (!sinCantidad(body)) return false;
  if (clave(body.establecimiento) !== "san-pablo") return true;
  if (!tareaDelPadron) return true;
  const nombre = sinAcentos(tareaDelPadron.tarea);
  return !TAREAS_SIN_CANTIDAD.some((t) => nombre.includes(t));
};

const faltantes = (body) => {
  const falta = [];
  if (!body.fecha) falta.push("la fecha");
  if (!body.persona) falta.push("la persona");
  if (!body.tarea) falta.push("la tarea");
  // El cliente define con qué precio se paga (04/10/2026).
  if (!String(body.cliente || "").trim()) falta.push("el cliente");
  // Terminado es el lote terminado: sin lote no se puede marcar (24/09/2026).
  if (body.terminado && !String(body.lote || "").trim()) falta.push("el lote del parte terminado");
  // La cantidad se controla aparte (`faltaLaCantidad`): en San Pablo hay
  // tareas que no la llevan y para saberlo hay que mirar el padrón.
  if (!sinCantidad(body) && isNaN(Number(body.cantidad))) falta.push("una cantidad válida");
  return falta;
};

// Un parte provisorio es el ayudamemoria de la mañana (30/09/2026): se guarda
// con lo que se sabe hasta ahí y se completa al terminar la jornada. No pasa
// por las validaciones de la carga; solo necesita saber de quién y de qué día
// es, y que los números sean números.
const esProvisorio = (body) => body.provisorio === true || body.provisorio === "true";

const faltantesDelProvisorio = (body) => {
  const falta = [];
  if (!body.fecha) falta.push("la fecha");
  if (!body.persona) falta.push("la persona");
  // También el provisorio: viene puesto en Citrusvil y no puede faltar.
  if (!String(body.cliente || "").trim()) falta.push("el cliente");
  if (!sinCantidad(body) && isNaN(Number(body.cantidad))) falta.push("una cantidad válida");
  return falta;
};

/**
 * El día que una persona dejó en provisorio y todavía no se completó.
 *
 * **Con un día en provisorio, a esa persona no se le carga ningún otro día**
 * —ni provisorio ni completo— hasta que todos los partes de ese día tengan sus
 * datos reales. Cada campo va por su cuenta: los partes de San Pablo y los de
 * Berdina son independientes, así que un día pendiente en uno no frena al otro.
 *
 * Devuelve el cuerpo del rechazo, o null si puede.
 */
const diaProvisorioPendiente = async (body, ignorarId = null) => {
  const dia = String(body.fecha || "").slice(0, 10);
  if (!DIA.test(dia) || !mongoose.isValidObjectId(body.persona)) return null;

  const filtro = {
    establecimiento: clave(body.establecimiento),
    persona: body.persona,
    provisorio: true,
    $or: [
      { fecha: { $lt: new Date(`${dia}T00:00:00.000Z`) } },
      { fecha: { $gt: new Date(`${dia}T23:59:59.999Z`) } },
    ],
  };
  if (ignorarId) filtro._id = { $ne: ignorarId };

  const pendiente = await ParteDiario.findOne(filtro).sort({ fecha: 1 }).select("fecha").lean();
  if (!pendiente) return null;

  const [a, m, d] = new Date(pendiente.fecha).toISOString().slice(0, 10).split("-");
  return {
    motivo: "PROVISORIO_PENDIENTE",
    fecha: pendiente.fecha,
    error:
      `Esta persona tiene partes provisorios del ${d}/${m}/${a}. Hay que completarlos ` +
      "con los datos reales antes de cargarle otro día.",
  };
};

// El CC del parte, con su tractor. Lo necesitan la validación del CC, la del
// horómetro y el registro de la lectura: se lee una vez y se pasa a las tres.
// Un CC vacío es válido (no es obligatorio); uno inventado no.
//
// El tractor se trae solo si el parte tiene alguna lectura de horómetro: sin
// lecturas no lo mira nadie, y ese populate es otra ida y vuelta al cluster en
// cada parte que se guarda (18/09/2026). `conTractor` avisa si vino, para no
// pasar un centro a medio leer a quien sí lo necesita.
const buscarCentroDelParte = async (cc, body = null) => {
  if (!cc) return { ok: true, centro: null, conTractor: true };
  if (!mongoose.isValidObjectId(cc)) return { ok: false, centro: null, conTractor: false };

  const conTractor =
    !body ||
    parsearHorometro(body.horomIngreso) !== null ||
    parsearHorometro(body.horomSalida) !== null;
  const consulta = CentroCosto.findById(cc);
  const centro = await (conTractor ? consulta.populate("tractor", "cc") : consulta);
  return { ok: Boolean(centro), centro, conTractor };
};

// El establecimiento llega por query o en el cuerpo. Sin el se asume
// Caspinchango, que es el unico que existia antes de separar los campos.
const clave = (valor) => {
  const c = (valor || "").trim();
  return CLAVES.includes(c) ? c : POR_DEFECTO;
};

// "2026-08": el certificado de un mes.
const CLAVE_PERIODO = /^\d{4}-\d{2}$/;

const armarDatos = (body) => {
  const datos = { ...body, establecimiento: clave(body.establecimiento) };
  datos.totalHoras = calcularTotalHoras(body);
  datos.horasCC = calcularHorasCC(body.horomIngreso, body.horomSalida);
  // Los numéricos vacíos llegan como "" desde el formulario.
  ["cantidad", "combustible", "combTurbo", "horomIngreso", "horomSalida"].forEach((campo) => {
    datos[campo] = body[campo] === "" || body[campo] === undefined || body[campo] === null
      ? null
      : Number(body[campo]);
  });
  datos.provisorio = esProvisorio(body);
  // Un provisorio no da un lote por terminado: eso dispara el pago.
  datos.terminado = Boolean(body.terminado) && !datos.provisorio;
  ["cc", "tarea"].forEach((campo) => {
    if (!body[campo]) datos[campo] = null;
  });
  // Mes al que quedó asignado un parte con fecha posterior al cierre. Sin
  // periodo el parte va por fecha y no guarda explicación.
  datos.periodo = CLAVE_PERIODO.test(String(body.periodo || "")) ? body.periodo : null;
  datos.motivoFueraDeCierre = datos.periodo ? String(body.motivoFueraDeCierre || "").trim() : "";
  return datos;
};

// Cargar, editar o borrar una jornada cambia el reparto del lote si el grupo
// ya está cerrado (las horas que se reparten son otras). Nunca debe voltear el
// guardado del parte: se rehace aparte y, si falla, queda en el log.
const rehacerReparto = (referencia) =>
  recalcularLote(referencia).catch((e) => {
    console.error("No se pudo rehacer el pago por lote:", e.message);
    return { estado: "nada" };
  });

// Los renglones de pago del lote terminado los arma el reparto: se corrigen
// editando la jornada que pagan, no a mano (25/09/2026).
const RENGLON_DE_PAGO =
  "Este renglón lo arma el pago por lote terminado: se corrige editando la jornada que paga.";

const RELACIONES = [
  { path: "persona", select: "apellidoNombre dni legajo" },
  { path: "cc", select: "cc equipo descripcion" },
  { path: "tarea", select: "tarea unidad empresa" },
];

const conRelaciones = (consulta) => consulta.populate(RELACIONES);

// Qué partes se piden. Acepta ?desde&hasta (ISO) o ?anio&mes para el mes
// calendario; sin nada, todos. Lo comparten el listado y los consumos entre
// cargas, para que los dos miren los mismos partes.
const filtroDePartes = (query) => {
  const { desde, hasta, anio, mes } = query;
  const filtro = { establecimiento: clave(query.establecimiento) };

  if (desde || hasta) {
    filtro.fecha = {};
    if (desde) filtro.fecha.$gte = new Date(desde);
    if (hasta) filtro.fecha.$lte = new Date(`${String(hasta).slice(0, 10)}T23:59:59.999Z`);
  } else if (anio && mes) {
    filtro.fecha = {
      $gte: new Date(Date.UTC(Number(anio), Number(mes) - 1, 1)),
      $lte: new Date(Date.UTC(Number(anio), Number(mes), 0, 23, 59, 59)),
    };
  }

  // Certificado de un mes (?periodo=2026-08): además del rango van los partes
  // con fecha posterior al cierre que se dejaron en este mes con una
  // explicación, y salen los del rango que quedaron asignados a otro mes.
  const { periodo } = query;
  if (typeof periodo === "string" && CLAVE_PERIODO.test(periodo) && filtro.fecha) {
    const rango = filtro.fecha;
    delete filtro.fecha;
    filtro.$or = [{ periodo }, { fecha: rango, periodo: { $in: [null, ""] } }];
  }
  return filtro;
};

/**
 * El consumo de gasoil entre cargas de los partes pedidos (27/09/2026), con
 * los mismos filtros que el listado. Ver services/consumos.service.js.
 */
export const getConsumos = async (req, res) => {
  try {
    const partes = await ParteDiario.find(filtroDePartes(req.query)).select("fecha cc turbo pagoDe").lean();
    res.json(await consumosDePartes(partes));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Listado del período.
export const getAll = async (req, res) => {
  try {
    const filtro = filtroDePartes(req.query);

    // El informe de tareas por personal suma cantidades, horas y filtra: no le
    // sirven los horarios, los horómetros ni el combustible. Con ?resumen=1 se
    // le manda lo justo, que es la mitad del cuerpo y sin hidratar documentos.
    // Las horas y el lote van porque el informe muestra cómo se repartió la
    // medida de un lote terminado (18/09/2026).
    // batchSize alto: el cursor trae de a 101 documentos por defecto, así que
    // un mes de partes son dos idas y vueltas al cluster en vez de una. Con la
    // latencia que hay (unos 70 ms por viaje) eso solo costaba ~90 ms.
    const consulta = ParteDiario.find(filtro).sort({ fecha: 1, createdAt: 1 }).batchSize(1000);
    const partes =
      req.query.resumen === "1"
        ? await consulta
            .select("fecha persona tarea cantidad cliente turbo cc totalHoras lote terminado repartido pagoDe provisorio")
            .populate([
              { path: "persona", select: "apellidoNombre legajo" },
              { path: "cc", select: "cc" },
              { path: "tarea", select: "tarea unidad" },
            ])
            .lean()
        : await conRelaciones(consulta);

    res.json(partes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Con qué horómetro quedó un CC: es el que la planilla pone en "Horóm. entra".
 *
 * **El horómetro es uno solo para todo el proyecto.** Si el CC está enlazado a
 * un tractor, la lectura sale de las cinco fuentes juntas —parte diario,
 * service, reparación, visita y carga manual (`lecturasDeTractor`)—, así que
 * una lectura tomada en el taller o en una visita es la que arrastra el
 * próximo parte, y al revés. Un CC sin tractor enlazado no tiene historial de
 * mantenimiento: ahí se miran solo los partes.
 *
 * Con ?fecha=AAAA-MM-DD se busca la última lectura anterior a ese día (o del
 * mismo día): así cargar o corregir un día atrasado no arrastra el horómetro
 * de un día posterior que ya está cargado. Sin fecha se toma hoy.
 *
 * Devuelve `{ horometro, fecha, fuente, campo }`, y `horomSalida` con el mismo
 * número por los que ya leían esa clave. `fuente` es la de
 * `lecturasDeTractor` ("parte", "service", "reparacion", "visita",
 * "horometro:…"), para poder decir en pantalla de dónde salió.
 */
export const getUltimoHorometro = async (req, res) => {
  try {
    const { cc } = req.params;
    if (!mongoose.isValidObjectId(cc)) {
      return res.status(400).json({ error: "Centro de costo inválido" });
    }

    const { fecha } = req.query;
    const dia = DIA.test(String(fecha || "")) ? fecha : null;
    const sinLectura = { cc, horometro: null, horomSalida: null, fecha: null, fuente: null };

    // El horómetro es de la máquina: el CC lo lleva solo si es un equipo del
    // padrón de Tractores.
    const centro = await CentroCosto.findById(cc).populate("tractor", "cc").lean();
    if (centro?.tractor) {
      const hasta = dia || new Date();
      const contexto = await contextoDeHorometro(centro.tractor._id, hasta, centro.tractor);
      const lectura = await ultimaLecturaAntesDe(centro.tractor._id, hasta, null, contexto);
      if (!lectura) return res.json(sinLectura);
      return res.json({
        cc,
        horometro: lectura.horometro,
        horomSalida: lectura.horometro,
        fecha: lectura.fecha,
        fuente: lectura.fuente,
        campo: lectura.campo,
      });
    }

    // CC que no es un equipo gestionado: su única historia son los partes.
    const filtro = { cc, horomSalida: { $ne: null }, provisorio: { $ne: true } };
    if (dia) filtro.fecha = { $lte: new Date(`${dia}T23:59:59.999Z`) };

    const ultimo = await ParteDiario.findOne(filtro)
      .sort({ fecha: -1, createdAt: -1 })
      .select("cc fecha horomSalida")
      .lean();

    if (!ultimo) return res.json(sinLectura);
    res.json({
      cc,
      horometro: ultimo.horomSalida,
      horomSalida: ultimo.horomSalida,
      fecha: ultimo.fecha,
      fuente: "parte",
      campo: "horomSalida",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los clientes que se escribieron en la planilla. No hay padrón: el listado
// sale de lo cargado, y lo usa la pantalla de Variables para saber a qué
// clientes se les puede poner precio.
export const getClientes = async (req, res) => {
  try {
    const clientes = await ParteDiario.distinct("cliente", {
      establecimiento: clave(req.query.establecimiento),
    });
    res.json(clientes.filter((c) => (c || "").trim()).sort((a, b) => a.localeCompare(b, "es")));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Los lotes que ya se dieron por terminados, con la fecha del cierre y la
// tarea. La planilla lo pide una vez al abrir el mes y con eso avisa si alguien
// carga trabajo en un lote terminado, sin tener que preguntar en cada parte.
export const getCierresDeLotes = async (req, res) => {
  try {
    res.json(await cierresDeLotes(clave(req.query.establecimiento)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const parte = await conRelaciones(ParteDiario.findById(req.params.id));
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    res.json(parte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const CC_INEXISTENTE = "El centro de costo no está dado de alta";

// Lo que frena el guardado de un parte común, antes de mirar el horómetro.
// Devuelve `{ status, cuerpo }` o null si pasa.
const rechazoDelParte = async (body, { tareaDelPadron, ok }) => {
  const falta = faltantes(body);
  if (faltaLaCantidad(body, tareaDelPadron)) falta.push("la cantidad");
  if (falta.length) return { status: 400, cuerpo: { error: `Falta ${falta.join(", ")}` } };
  if (tramosSeSolapan(body)) {
    return {
      status: 400,
      cuerpo: {
        error: "Los dos tramos del día se pisan: la Entrada 2 tiene que ser posterior a la Salida 1",
      },
    };
  }
  if (!ok) return { status: 400, cuerpo: { error: CC_INEXISTENTE } };
  const unidadMal = await desmalezadoFueraDeUnidad(body, tareaDelPadron);
  return unidadMal ? { status: 400, cuerpo: { error: unidadMal } } : null;
};

// Lo único que frena a un provisorio por sus datos: no saber de quién o de qué
// día es, y un CC que no existe (no hay a qué enlazarlo).
const rechazoDelProvisorio = (body, ok) => {
  const falta = faltantesDelProvisorio(body);
  if (falta.length) return { status: 400, cuerpo: { error: `Falta ${falta.join(", ")}` } };
  if (!ok) return { status: 400, cuerpo: { error: CC_INEXISTENTE } };
  return null;
};

// "AAAA-MM-DD" de una fecha guardada o de la que llega en el cuerpo.
const diaDe = (fecha) =>
  fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha || "").slice(0, 10);

export const create = async (req, res) => {
  try {
    // Las lecturas son independientes: van juntas para no pagar varias idas y
    // vueltas al cluster antes de guardar.
    const [tareaDelPadron, { ok, centro, conTractor }, pendiente, cliente] = await Promise.all([
      buscarTareaDelParte(req.body),
      buscarCentroDelParte(req.body.cc, req.body),
      diaProvisorioPendiente(req.body),
      clienteDelPadron(req.body.cliente),
    ]);

    const provisorio = esProvisorio(req.body);
    const rechazo = provisorio
      ? rechazoDelProvisorio(req.body, ok)
      : await rechazoDelParte(req.body, { tareaDelPadron, ok });
    if (rechazo) return res.status(rechazo.status).json(rechazo.cuerpo);
    // El cliente tiene que estar en el padrón; se guarda escrito como allá.
    if (!cliente) return res.status(400).json({ error: NO_ES_DEL_PADRON });
    req.body.cliente = cliente;
    // Con un día en provisorio no se le carga otro, sea provisorio o completo.
    if (pendiente) return res.status(409).json(pendiente);

    if (!provisorio) {
      const chequeo = await chequearHorometroDelParte(req.body, centro);
      if (!chequeo.ok) return res.status(409).json(chequeo);
    }

    const parte = new ParteDiario(armarDatos(req.body));
    await parte.save();

    // Las dos cosas que pasan después de guardar son de colecciones distintas
    // y no se esperan entre sí:
    // - si el CC es un tractor, la lectura entra a su historial de horómetros
    //   (nunca debe voltear el alta del parte: se registra aparte). Un
    //   provisorio no deja lectura: la deja cuando se lo completa;
    // - una jornada que entra en un lote ya terminado cambia el reparto.
    const [, reparto] = await Promise.all([
      provisorio
        ? null
        : registrarLecturaDeParte(parte, { centro: conTractor ? centro : null, nuevo: true }).catch((e) =>
            console.error("No se pudo registrar la lectura del parte:", e.message)
          ),
      rehacerReparto(referenciaDeLote(parte, { tareaDelPadron })),
    ]);

    // Si hubo reparto el parte quedó con la cantidad que le tocó y se lo vuelve
    // a leer; si no, se puebla el documento que ya está en memoria en vez de
    // pedirlo de nuevo.
    const guardado =
      reparto.estado === "repartido"
        ? await conRelaciones(ParteDiario.findById(parte._id))
        : await parte.populate(RELACIONES);
    res.status(201).json({ ...guardado.toObject(), reparto });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    // Las lecturas son independientes y van juntas. `anterior` es cómo estaba
    // el parte: si cambió de lote o de tarea, el grupo que deja atrás también
    // hay que rehacerlo.
    const [tareaDelPadron, { ok, centro, conTractor }, anterior, pendiente, cliente] = await Promise.all([
      buscarTareaDelParte(req.body),
      buscarCentroDelParte(req.body.cc, req.body),
      ParteDiario.findById(req.params.id)
        .select("establecimiento persona tarea lote fecha pagoDe cc horomIngreso horomSalida provisorio")
        .lean(),
      diaProvisorioPendiente(req.body, req.params.id),
      clienteDelPadron(req.body.cliente),
    ]);
    if (anterior?.pagoDe) return res.status(400).json({ error: RENGLON_DE_PAGO });

    const provisorio = esProvisorio(req.body);
    const rechazo = provisorio
      ? rechazoDelProvisorio(req.body, ok)
      : await rechazoDelParte(req.body, { tareaDelPadron, ok });
    if (rechazo) return res.status(rechazo.status).json(rechazo.cuerpo);
    if (!cliente) return res.status(400).json({ error: NO_ES_DEL_PADRON });
    req.body.cliente = cliente;

    // Con un día en provisorio no se le carga otro. Corregir un parte completo
    // de otro día sin cambiarle la fecha ni la persona no es cargar un día: eso
    // se deja, si no el provisorio de hoy trabaría cualquier arreglo de ayer.
    const cargaOtroDia =
      provisorio ||
      !anterior ||
      diaDe(anterior.fecha) !== diaDe(req.body.fecha) ||
      String(anterior.persona || "") !== String(req.body.persona || "");
    if (pendiente && cargaOtroDia) return res.status(409).json(pendiente);

    // Una edición que no toca el horómetro, la fecha ni el CC no se vuelve a
    // validar: lo que la máquina marcó después no tiene por qué frenar que se
    // corrija una tarea o una hora (27/09/2026). El que deja de ser provisorio
    // sí se valida: su horómetro nunca pasó por acá.
    if (!provisorio && (anterior?.provisorio || !mismoHorometro(anterior, req.body))) {
      const chequeo = await chequearHorometroDelParte(req.body, centro, req.params.id);
      if (!chequeo.ok) return res.status(409).json(chequeo);
    }

    const parte = await conRelaciones(
      ParteDiario.findByIdAndUpdate(req.params.id, armarDatos(req.body), {
        new: true,
        runValidators: true,
      })
    );
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });

    const cambioDeGrupo =
      anterior &&
      (String(anterior.tarea || "") !== String(parte.tarea?._id || "") ||
        (anterior.lote || "").trim() !== (parte.lote || "").trim());

    const [, , reparto] = await Promise.all([
      // Un parte que pasa a provisorio se lleva la lectura que había dejado.
      (provisorio
        ? borrarLecturaDeParte(anterior)
        : registrarLecturaDeParte(parte, { centro: conTractor ? centro : null })
      ).catch((e) => console.error("No se pudo registrar la lectura del parte:", e.message)),
      cambioDeGrupo ? rehacerReparto(referenciaDeLote(anterior)) : null,
      rehacerReparto(referenciaDeLote(parte, { tareaDelPadron })),
    ]);
    const guardado =
      reparto.estado === "repartido"
        ? await conRelaciones(ParteDiario.findById(parte._id))
        : parte;
    res.json({ ...guardado.toObject(), reparto });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const existente = await ParteDiario.findById(req.params.id).select("pagoDe").lean();
    if (!existente) return res.status(404).json({ error: "Parte no encontrado" });
    if (existente.pagoDe) return res.status(400).json({ error: RENGLON_DE_PAGO });

    const parte = await ParteDiario.findByIdAndDelete(req.params.id);
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    // El renglón que pagaba esta jornada en la certificación del cierre se va
    // con ella; el reparto de abajo rehace el resto del grupo.
    await ParteDiario.deleteMany({ pagoDe: parte._id });

    // La lectura que dejó este parte se va con él: el horómetro del tractor
    // vuelve a ser el que estaba vigente antes de cargarlo.
    await borrarLecturaDeParte(parte).catch((e) =>
      console.error("No se pudo deshacer la lectura del parte:", e.message)
    );

    // Las horas que se repartían eran otras: el grupo que queda se rehace sin
    // esta jornada. Va en la respuesta para que la pantalla sepa si le cambió
    // algo a las otras filas.
    const reparto = await rehacerReparto(referenciaDeLote(parte));

    res.json({ message: "Parte eliminado", reparto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
