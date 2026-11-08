import mongoose from "mongoose";
import Jornalizado from "../models/Jornalizado.js";
import Personal from "../models/Personal.js";
import { CLAVES, POR_DEFECTO } from "../models/Establecimiento.js";
import { calcularTotalHoras, tramosSeSolapan } from "./partes.controller.js";

/**
 * Los jornalizados de un campo (02/11/2026): una fila por persona y día con el
 * horario en dos tramos y la tarea realizada escrita a mano. Las horas se
 * cuentan igual que en los partes (calcularTotalHoras) y los tramos tampoco
 * se pueden pisar.
 *
 * Obligatorios: fecha, personal, la tarea realizada y al menos un tramo
 * completo (entrada y salida). Con Provisorio se guarda con solo fecha y
 * personal, y rige la misma regla que en los partes: con un día provisorio sin
 * completar, a esa persona no se le carga otro día en este campo.
 */

const establecimientoDe = (valor) => {
  const c = String(valor || "").trim();
  return CLAVES.includes(c) ? c : POR_DEFECTO;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^(\d{1,2}):(\d{2})$/;
const HORARIOS = ["horaIngreso", "horaEgreso", "horaIngreso2", "horaEgreso2"];

const conPersona = (consulta) => consulta.populate({ path: "persona", select: "apellidoNombre legajo" });

const esProvisorio = (body) => body.provisorio === true || body.provisorio === "true";
const esColchonHs = (body) => body.colchonHs === true || body.colchonHs === "true";
const diaDe = (fecha) => (fecha ? new Date(fecha).toISOString().slice(0, 10) : "");

// Lo que se guarda, ya validado. Devuelve { error } o { datos }.
const armarDatos = (body) => {
  const provisorio = esProvisorio(body);
  const dia = String(body.fecha || "").slice(0, 10);
  const falta = [];
  if (!DIA.test(dia)) falta.push("la fecha");
  if (!body.persona) falta.push("el personal");

  // Colch. Hs. solo en Berdina (08/11/2026): en San Pablo queda apagado.
  const colchonHs = esColchonHs(body) && establecimientoDe(body.establecimiento) !== "san-pablo";
  const datos = { fecha: new Date(dia), persona: body.persona, provisorio, colchonHs };
  for (const campo of HORARIOS) {
    const valor = String(body[campo] || "").trim();
    if (valor && !HORA.test(valor)) return { error: "Hay un horario que no es una hora (HH:mm)" };
    datos[campo] = valor;
  }
  datos.tarea = String(body.tarea || "").trim();

  if (!provisorio) {
    const tramoCompleto =
      (datos.horaIngreso && datos.horaEgreso) || (datos.horaIngreso2 && datos.horaEgreso2);
    if (!tramoCompleto) falta.push("un horario completo (entrada y salida)");
    if (!datos.tarea) falta.push("la tarea realizada");
  } else if (datos.colchonHs && !datos.tarea) {
    // Con Colch. Hs. la tarea realizada va siempre, como las observaciones
    // en los partes (08/11/2026).
    falta.push("la tarea realizada (con Colch. Hs. es obligatoria)");
  }
  if (falta.length) return { error: `Falta ${falta.join(", ")}` };

  if (!provisorio && tramosSeSolapan(datos)) {
    return { error: "El segundo tramo se pisa con el primero: la Entrada 2 tiene que ser posterior a la Salida 1" };
  }
  datos.totalHoras = calcularTotalHoras(datos);
  if (!mongoose.isValidObjectId(datos.persona)) return { error: "Ese personal no existe" };
  return { datos };
};

/**
 * La persona con lo que muestra la tabla. Se busca una vez y sirve para
 * controlar que exista y para armar la respuesta, sin un populate aparte.
 * Cada consulta a la base es una ida y vuelta (~90 ms): por eso guardar
 * hace las que puede en paralelo (02/11/2026).
 */
const buscarPersona = (id) => Personal.findById(id).select("apellidoNombre legajo").lean();

/**
 * El otro día que la persona dejó en provisorio en este campo. Devuelve el
 * cuerpo del rechazo (409) o null. Igual que `diaProvisorioPendiente` de los
 * partes.
 */
const diaProvisorioPendiente = async (establecimiento, datos, ignorarId = null) => {
  const dia = diaDe(datos.fecha);
  const filtro = {
    establecimiento,
    persona: datos.persona,
    provisorio: true,
    $or: [
      { fecha: { $lt: new Date(`${dia}T00:00:00.000Z`) } },
      { fecha: { $gt: new Date(`${dia}T23:59:59.999Z`) } },
    ],
  };
  if (ignorarId) filtro._id = { $ne: ignorarId };
  const pendiente = await Jornalizado.findOne(filtro).sort({ fecha: 1 }).select("fecha").lean();
  if (!pendiente) return null;
  const [a, m, d] = diaDe(pendiente.fecha).split("-");
  return {
    motivo: "PROVISORIO_PENDIENTE",
    fecha: pendiente.fecha,
    error:
      `Esta persona tiene un jornalizado provisorio del ${d}/${m}/${a}. Hay que completarlo ` +
      "con los datos reales antes de cargarle otro día.",
  };
};

// GET /api/jornalizados?establecimiento=&desde=&hasta=
export const getAll = async (req, res) => {
  try {
    const filtro = { establecimiento: establecimientoDe(req.query.establecimiento) };
    const { desde, hasta } = req.query;
    if (DIA.test(String(desde || "")) || DIA.test(String(hasta || ""))) {
      filtro.fecha = {};
      if (DIA.test(String(desde || ""))) filtro.fecha.$gte = new Date(desde);
      if (DIA.test(String(hasta || ""))) filtro.fecha.$lte = new Date(`${hasta}T23:59:59.999Z`);
    }
    const filas = await conPersona(Jornalizado.find(filtro).sort({ fecha: 1, createdAt: 1 })).lean();
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const { error, datos } = armarDatos(req.body);
    if (error) return res.status(400).json({ error });
    const establecimiento = establecimientoDe(req.body.establecimiento);
    // Con un día en provisorio no se le carga otro, sea provisorio o completo.
    const [persona, pendiente] = await Promise.all([
      buscarPersona(datos.persona),
      diaProvisorioPendiente(establecimiento, datos),
    ]);
    if (!persona) return res.status(400).json({ error: "Ese personal no existe" });
    if (pendiente) return res.status(409).json(pendiente);
    const nuevo = await Jornalizado.create({ ...datos, establecimiento });
    res.status(201).json({ ...nuevo.toObject(), persona });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const { error, datos } = armarDatos(req.body);
    if (error) return res.status(400).json({ error });
    const [persona, anterior] = await Promise.all([
      buscarPersona(datos.persona),
      Jornalizado.findById(req.params.id).select("establecimiento fecha persona").lean(),
    ]);
    if (!anterior) return res.status(404).json({ error: "No existe ese jornalizado" });
    if (!persona) return res.status(400).json({ error: "Ese personal no existe" });
    // Manda el campo guardado: en San Pablo no hay Colch. Hs.
    if (anterior.establecimiento === "san-pablo") datos.colchonHs = false;

    // Corregir uno completo de otro día sin cambiarle la fecha ni la persona
    // no es cargar un día: se deja, como en los partes.
    const cargaOtroDia =
      datos.provisorio ||
      diaDe(anterior.fecha) !== diaDe(datos.fecha) ||
      String(anterior.persona) !== String(datos.persona);
    if (cargaOtroDia) {
      const pendiente = await diaProvisorioPendiente(anterior.establecimiento, datos, req.params.id);
      if (pendiente) return res.status(409).json(pendiente);
    }

    const fila = await Jornalizado.findByIdAndUpdate(
      req.params.id,
      { $set: datos },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!fila) return res.status(404).json({ error: "No existe ese jornalizado" });
    res.json({ ...fila, persona });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const fila = await Jornalizado.findByIdAndDelete(req.params.id);
    if (!fila) return res.status(404).json({ error: "No existe ese jornalizado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
