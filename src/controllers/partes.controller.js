import mongoose from "mongoose";
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
} from "../services/repartoLotes.service.js";
import {
  validarLectura,
  contextoDeHorometro,
  parsearHorometro,
  calcularHorasCC,
} from "../services/horometros.service.js";

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
  // La cantidad se controla aparte (`faltaLaCantidad`): en San Pablo hay
  // tareas que no la llevan y para saberlo hay que mirar el padrón.
  if (!sinCantidad(body) && isNaN(Number(body.cantidad))) falta.push("una cantidad válida");
  return falta;
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
  datos.terminado = Boolean(body.terminado);
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

const RELACIONES = [
  { path: "persona", select: "apellidoNombre dni legajo" },
  { path: "cc", select: "cc equipo descripcion" },
  { path: "tarea", select: "tarea unidad empresa" },
];

const conRelaciones = (consulta) => consulta.populate(RELACIONES);

// Listado del período. Acepta ?desde&hasta (ISO) o ?anio&mes para el mes
// calendario; sin nada devuelve todo.
export const getAll = async (req, res) => {
  try {
    const { desde, hasta, anio, mes } = req.query;
    const filtro = { establecimiento: clave(req.query.establecimiento) };

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
    const { periodo } = req.query;
    if (typeof periodo === "string" && CLAVE_PERIODO.test(periodo) && filtro.fecha) {
      const rango = filtro.fecha;
      delete filtro.fecha;
      filtro.$or = [{ periodo }, { fecha: rango, periodo: { $in: [null, ""] } }];
    }

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
            .select("fecha persona tarea cantidad cliente turbo cc totalHoras lote terminado repartido")
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

// El horómetro de salida de un CC es el de entrada de su próxima carga. La
// búsqueda es sobre todos los partes, no sobre el período en pantalla: el
// último horómetro de marzo es el primero de abril. Vive acá y no en el front
// porque el mismo dato lo va a consultar el sector de tractores.
export const getUltimoHorometro = async (req, res) => {
  try {
    const { cc } = req.params;
    if (!mongoose.isValidObjectId(cc)) {
      return res.status(400).json({ error: "Centro de costo inválido" });
    }

    const ultimo = await ParteDiario.findOne({ cc, horomSalida: { $ne: null } })
      .sort({ fecha: -1, createdAt: -1 })
      .select("cc fecha horomSalida")
      .lean();

    if (!ultimo) return res.json({ cc, horomSalida: null, fecha: null });
    res.json({ cc, horomSalida: ultimo.horomSalida, fecha: ultimo.fecha });
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

export const create = async (req, res) => {
  try {
    // Las dos lecturas son independientes: van juntas para no pagar dos idas y
    // vueltas al cluster antes de guardar.
    const [tareaDelPadron, { ok, centro, conTractor }] = await Promise.all([
      buscarTareaDelParte(req.body),
      buscarCentroDelParte(req.body.cc, req.body),
    ]);

    const falta = faltantes(req.body);
    if (faltaLaCantidad(req.body, tareaDelPadron)) falta.push("la cantidad");
    if (falta.length) {
      return res.status(400).json({ error: `Falta ${falta.join(", ")}` });
    }
    if (tramosSeSolapan(req.body)) {
      return res.status(400).json({
        error: "Los dos tramos del día se pisan: la Entrada 2 tiene que ser posterior a la Salida 1",
      });
    }
    if (!ok) {
      return res.status(400).json({ error: "El centro de costo no está dado de alta" });
    }

    const chequeo = await chequearHorometroDelParte(req.body, centro);
    if (!chequeo.ok) return res.status(409).json(chequeo);

    const parte = new ParteDiario(armarDatos(req.body));
    await parte.save();

    // Las dos cosas que pasan después de guardar son de colecciones distintas
    // y no se esperan entre sí:
    // - si el CC es un tractor, la lectura entra a su historial de horómetros
    //   (nunca debe voltear el alta del parte: se registra aparte);
    // - una jornada que entra en un lote ya terminado cambia el reparto.
    const [, reparto] = await Promise.all([
      registrarLecturaDeParte(parte, { centro: conTractor ? centro : null, nuevo: true }).catch((e) =>
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
    // Las tres lecturas son independientes y van juntas. `anterior` es cómo
    // estaba el parte: si cambió de lote o de tarea, el grupo que deja atrás
    // también hay que rehacerlo.
    const [tareaDelPadron, { ok, centro, conTractor }, anterior] = await Promise.all([
      buscarTareaDelParte(req.body),
      buscarCentroDelParte(req.body.cc, req.body),
      ParteDiario.findById(req.params.id).select("establecimiento tarea lote fecha").lean(),
    ]);

    const falta = faltantes(req.body);
    if (faltaLaCantidad(req.body, tareaDelPadron)) falta.push("la cantidad");
    if (falta.length) {
      return res.status(400).json({ error: `Falta ${falta.join(", ")}` });
    }
    if (tramosSeSolapan(req.body)) {
      return res.status(400).json({
        error: "Los dos tramos del día se pisan: la Entrada 2 tiene que ser posterior a la Salida 1",
      });
    }
    if (!ok) {
      return res.status(400).json({ error: "El centro de costo no está dado de alta" });
    }

    const chequeo = await chequearHorometroDelParte(req.body, centro, req.params.id);
    if (!chequeo.ok) return res.status(409).json(chequeo);

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
      registrarLecturaDeParte(parte, { centro: conTractor ? centro : null }).catch((e) =>
        console.error("No se pudo registrar la lectura del parte:", e.message)
      ),
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
    const parte = await ParteDiario.findByIdAndDelete(req.params.id);
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });

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
