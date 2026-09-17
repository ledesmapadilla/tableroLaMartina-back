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

const sinCantidad = (body) =>
  body.cantidad === "" || body.cantidad === null || body.cantidad === undefined;

// En San Pablo el desmalezado y el herbicida se cargan sin cantidad
// (17/09/2026); las demás tareas la llevan, como en Caspinchango.
export const TAREAS_SIN_CANTIDAD = ["desmalezado", "herbicida"];

const sinAcentos = (t) =>
  (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const faltaLaCantidad = async (body) => {
  if (!sinCantidad(body)) return false;
  if (clave(body.establecimiento) !== "san-pablo") return true;
  if (!mongoose.isValidObjectId(body.tarea)) return true;
  const tarea = await Tarea.findById(body.tarea).select("tarea").lean();
  const nombre = sinAcentos(tarea?.tarea);
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
const buscarCentroDelParte = async (cc) => {
  if (!cc) return { ok: true, centro: null };
  if (!mongoose.isValidObjectId(cc)) return { ok: false, centro: null };
  const centro = await CentroCosto.findById(cc).populate("tractor", "cc");
  return { ok: Boolean(centro), centro };
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

    // El informe de tareas por personal solo suma cantidades y filtra: no le
    // sirven los horarios, los horómetros ni el combustible. Con ?resumen=1 se
    // le manda lo justo, que es la mitad del cuerpo y sin hidratar documentos.
    // batchSize alto: el cursor trae de a 101 documentos por defecto, así que
    // un mes de partes son dos idas y vueltas al cluster en vez de una. Con la
    // latencia que hay (unos 70 ms por viaje) eso solo costaba ~90 ms.
    const consulta = ParteDiario.find(filtro).sort({ fecha: 1, createdAt: 1 }).batchSize(1000);
    const partes =
      req.query.resumen === "1"
        ? await consulta
            .select("fecha persona tarea cantidad cliente turbo cc")
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
    const falta = faltantes(req.body);
    if (await faltaLaCantidad(req.body)) falta.push("la cantidad");
    if (falta.length) {
      return res.status(400).json({ error: `Falta ${falta.join(", ")}` });
    }
    const { ok, centro } = await buscarCentroDelParte(req.body.cc);
    if (!ok) {
      return res.status(400).json({ error: "El centro de costo no está dado de alta" });
    }

    const chequeo = await chequearHorometroDelParte(req.body, centro);
    if (!chequeo.ok) return res.status(409).json(chequeo);

    const parte = new ParteDiario(armarDatos(req.body));
    await parte.save();
    // Si el CC es un tractor, la lectura entra a su historial de horómetros.
    // Nunca debe voltear el alta del parte: se registra aparte.
    await registrarLecturaDeParte(parte, { centro, nuevo: true }).catch((e) =>
      console.error("No se pudo registrar la lectura del parte:", e.message)
    );
    // Se puebla el documento que ya está en memoria en vez de volver a leerlo.
    res.status(201).json(await parte.populate(RELACIONES));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const falta = faltantes(req.body);
    if (await faltaLaCantidad(req.body)) falta.push("la cantidad");
    if (falta.length) {
      return res.status(400).json({ error: `Falta ${falta.join(", ")}` });
    }
    const { ok, centro } = await buscarCentroDelParte(req.body.cc);
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
    await registrarLecturaDeParte(parte, { centro }).catch((e) =>
      console.error("No se pudo registrar la lectura del parte:", e.message)
    );
    res.json(parte);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alterna el estado del trabajo (en proceso / terminado) desde la tabla, sin
// pasar por la validación del parte entero: es lo único que cambia.
export const setTerminado = async (req, res) => {
  try {
    const parte = await conRelaciones(
      ParteDiario.findByIdAndUpdate(
        req.params.id,
        { terminado: Boolean(req.body.terminado) },
        { new: true, runValidators: true }
      )
    );
    if (!parte) return res.status(404).json({ error: "Parte no encontrado" });
    res.json(parte);
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

    res.json({ message: "Parte eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
