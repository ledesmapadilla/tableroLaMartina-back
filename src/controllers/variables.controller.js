import mongoose from "mongoose";
import VariableTarea from "../models/VariableTarea.js";
import Tarea from "../models/Tarea.js";
import { CLAVES, POR_DEFECTO } from "../models/Establecimiento.js";
import { clienteDelPadron, NO_ES_DEL_PADRON } from "./clientes.controller.js";

// De qué campo son los precios. Si no viene o no es un campo, Berdina, que es
// el que tenía todo antes de separarlos.
const campoPedido = (valor) => (CLAVES.includes(valor) ? valor : POR_DEFECTO);


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
  const netoAlto = aNumero(body.netoAlto);
  return {
    cliente: (body.cliente || "").trim(),
    neto,
    bruto: brutoDesdeNeto(neto),
    cantAlto: aNumero(body.cantAlto),
    netoAlto,
    brutoAlto: brutoDesdeNeto(netoAlto),
    fecha: aFecha(body.fecha),
    vigenciaDesde: aFecha(body.vigenciaDesde),
  };
};

// Todos los campos son obligatorios: un precio a medio cargar no sirve para
// certificar y ensucia el historial.
const queFalta = (datos) => {
  // El cliente define a qué partes se aplica el precio (04/10/2026).
  if (!datos.cliente) return "Falta el cliente";
  if (datos.neto === null) return "Falta el importe neto";
  if (!Number.isFinite(datos.neto)) return "El importe neto no es un número";
  // El de alto rendimiento es optativo, pero si viene tiene que ser un número.
  if (datos.cantAlto !== null && !Number.isFinite(datos.cantAlto)) {
    return "La cantidad de alto rendimiento no es un número";
  }
  if (datos.netoAlto !== null && !Number.isFinite(datos.netoAlto)) {
    return "El importe neto de alto rendimiento no es un número";
  }
  if (!datos.fecha) return "Falta la fecha";
  if (!datos.vigenciaDesde) return "Falta la fecha de vigencia";
  return null;
};

// Todas las cargas, de la vigencia más nueva a la más vieja: así la primera de
// cada tarea y cliente es la que está rigiendo. Vienen las de todos los
// clientes: la pantalla elige cuál mostrar.
export const getAll = async (req, res) => {
  try {
    // Cada campo vuelve a tener sus precios (30/09/2026): Remuneración se
    // abre en Berdina y San Pablo. Del 18/09 al 30/09 fueron uno solo para
    // todo Producción; al separarlos, los dos arrancaron con la misma lista.
    const variables = await VariableTarea.find({
      establecimiento: campoPedido(req.query.establecimiento),
    })
      .populate(RELACIONES)
      .sort({ vigenciaDesde: -1, fecha: -1, createdAt: -1 })
      .lean();

    // Las tareas borradas dejan cargas huérfanas: no se devuelven, la pantalla
    // arma el listado a partir del padrón de tareas.
    res.json(variables.filter((v) => v.tarea));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Alta de un precio. Cada alta es una fila nueva: la anterior de esa tarea y
// cliente pasa a ser historial.
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
    // El cliente tiene que estar en el padrón; se guarda escrito como allá.
    datos.cliente = await clienteDelPadron(datos.cliente);
    if (!datos.cliente) return res.status(400).json({ error: NO_ES_DEL_PADRON });

    const variable = new VariableTarea({
      establecimiento: campoPedido(req.body.establecimiento),
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
    datos.cliente = await clienteDelPadron(datos.cliente);
    if (!datos.cliente) return res.status(400).json({ error: NO_ES_DEL_PADRON });

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
