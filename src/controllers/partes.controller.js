import mongoose from "mongoose";
import ParteDiario from "../models/ParteDiario.js";
import {
  registrarLecturaDeParte,
  borrarLecturaDeParte,
} from "./horometrostractor.controller.js";
import CentroCosto from "../models/CentroCosto.js";
import {
  validarLectura,
  contextoDeHorometro,
  parsearHorometro,
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

// Único campo que no se carga a mano. Si el egreso es anterior al ingreso el
// turno cruzó la medianoche (22:00 → 06:00 son 8 horas, no -16).
const calcularTotalHoras = (horaIngreso, horaEgreso) => {
  const ingreso = aMinutos(horaIngreso);
  const egreso = aMinutos(horaEgreso);
  if (ingreso === null || egreso === null) return 0;

  const minutos = egreso >= ingreso ? egreso - ingreso : 1440 - ingreso + egreso;
  // Se redondea a 2 decimales: restando horas del reloj nunca hace falta más.
  return Math.round((minutos / 60) * 100) / 100;
};

// Horas de la máquina en el centro de costo. El horómetro solo avanza, así
// que una salida menor que el ingreso es un error de carga: se deja en 0.
const calcularHorasCC = (ingreso, salida) => {
  const i = Number(ingreso);
  const s = Number(salida);
  if (!Number.isFinite(i) || !Number.isFinite(s) || s <= i) return 0;
  return Math.round((s - i) * 100) / 100;
};

const faltantes = (body) => {
  const falta = [];
  if (!body.fecha) falta.push("la fecha");
  if (!body.persona) falta.push("la persona");
  if (!body.tarea) falta.push("la tarea");
  if (body.cantidad === "" || body.cantidad === null || body.cantidad === undefined) {
    falta.push("la cantidad");
  } else if (isNaN(Number(body.cantidad))) {
    falta.push("una cantidad válida");
  }
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

const armarDatos = (body) => {
  const datos = { ...body };
  datos.totalHoras = calcularTotalHoras(body.horaIngreso, body.horaEgreso);
  datos.horasCC = calcularHorasCC(body.horomIngreso, body.horomSalida);
  // Los numéricos vacíos llegan como "" desde el formulario.
  ["cantidad", "combustible", "combTurbo", "horomIngreso", "horomSalida"].forEach((campo) => {
    datos[campo] = body[campo] === "" || body[campo] === undefined || body[campo] === null
      ? null
      : Number(body[campo]);
  });
  ["cc", "tarea"].forEach((campo) => {
    if (!body[campo]) datos[campo] = null;
  });
  return datos;
};

const RELACIONES = [
  { path: "persona", select: "apellidoNombre dni" },
  { path: "cc", select: "cc equipo descripcion" },
  { path: "tarea", select: "tarea unidad empresa" },
];

const conRelaciones = (consulta) => consulta.populate(RELACIONES);

// Listado del período. Acepta ?desde&hasta (ISO) o ?anio&mes para el mes
// calendario; sin nada devuelve todo.
export const getAll = async (req, res) => {
  try {
    const { desde, hasta, anio, mes } = req.query;
    const filtro = {};

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

    const partes = await conRelaciones(ParteDiario.find(filtro)).sort({ fecha: 1, createdAt: 1 });
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
