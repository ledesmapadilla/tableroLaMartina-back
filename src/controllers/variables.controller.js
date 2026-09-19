import mongoose from "mongoose";
import VariableTarea from "../models/VariableTarea.js";
import Tarea from "../models/Tarea.js";
import { POR_DEFECTO } from "../models/Establecimiento.js";


const RELACIONES = { path: "tarea", select: "tarea unidad empresa" };

// Los numéricos vacíos llegan como "" desde el formulario.
const aNumero = (valor) =>
  valor === "" || valor === undefined || valor === null ? null : Number(valor);

const aFecha = (valor) => {
  if (!valor) return null;
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
};

// Lo que se descuenta del bruto para llegar al neto. El que se carga es el
// neto: el bruto sale de esta cuenta y no se toma del formulario, así los dos
// importes no pueden quedar despareados.
const RETENCION = 0.205;

const brutoDesdeNeto = (neto) =>
  neto === null || !Number.isFinite(neto) ? null : Math.round((neto / (1 - RETENCION)) * 100) / 100;

// Datos comunes al alta y a la edición. La tarea solo se toma en el alta: una
// carga no cambia de tarea, se borra y se hace de nuevo.
const armarDatos = (body) => {
  const neto = aNumero(body.neto);
  return {
    neto,
    bruto: brutoDesdeNeto(neto),
    fecha: aFecha(body.fecha),
    vigenciaDesde: aFecha(body.vigenciaDesde),
  };
};

// Todos los campos son obligatorios: un precio a medio cargar no sirve para
// certificar y ensucia el historial.
const queFalta = (datos) => {
  if (datos.neto === null) return "Falta el importe neto";
  if (!Number.isFinite(datos.neto)) return "El importe neto no es un número";
  if (!datos.fecha) return "Falta la fecha";
  if (!datos.vigenciaDesde) return "Falta la fecha de vigencia";
  return null;
};

// Todas las cargas, de la vigencia más nueva a la más vieja: así la primera de
// cada tarea es la que está rigiendo.
export const getAll = async (req, res) => {
  try {
    // El precio de una tarea es uno solo para todo Producción (18/09/2026):
    // dejó de distinguir campo, igual que ya había dejado de distinguir
    // cliente. Por eso no se filtra por establecimiento y el historial de los
    // dos campos queda mezclado en una sola línea de tiempo. Las cargas viejas
    // conservan el campo en el que se hicieron, pero solo como dato.
    const variables = await VariableTarea.find()
      .populate(RELACIONES)
      .sort({ vigenciaDesde: -1, fecha: -1, createdAt: -1 });

    // Las tareas borradas dejan cargas huérfanas: no se devuelven, la pantalla
    // arma el listado a partir del padrón de tareas.
    res.json(variables.filter((v) => v.tarea));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Alta de un precio. Cada alta es una fila nueva: la anterior de esa tarea
// pasa a ser historial.
export const create = async (req, res) => {
  try {
    const { tarea } = req.body;
    if (!mongoose.isValidObjectId(tarea)) {
      return res.status(400).json({ error: "Hay que elegir la tarea" });
    }
    if (!(await Tarea.exists({ _id: tarea }))) {
      return res.status(404).json({ error: "La tarea no está dada de alta" });
    }

    const datos = armarDatos(req.body);
    const error = queFalta(datos);
    if (error) return res.status(400).json({ error });

    // El precio vale para todos los campos, así que el establecimiento de una
    // carga nueva es solo el que pide el modelo: nadie lo lee para buscar el
    // precio.
    const variable = new VariableTarea({
      establecimiento: POR_DEFECTO,
      tarea,
      ...datos,
    });
    await variable.save();
    res.status(201).json(await variable.populate(RELACIONES));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Corrige una carga existente sin agregar otra al historial.
export const update = async (req, res) => {
  try {
    const datos = armarDatos(req.body);
    const error = queFalta(datos);
    if (error) return res.status(400).json({ error });

    const variable = await VariableTarea.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    }).populate(RELACIONES);

    if (!variable) return res.status(404).json({ error: "La carga no existe" });
    res.json(variable);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Borra una carga del historial. Si era la vigente, pasa a regir la anterior.
export const remove = async (req, res) => {
  try {
    const borrado = await VariableTarea.findByIdAndDelete(req.params.id);
    if (!borrado) return res.status(404).json({ error: "La carga no existe" });
    res.json({ message: "Precio eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
