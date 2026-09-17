import Lote from "../models/Lote.js";
import { CLAVES, POR_DEFECTO } from "../models/Establecimiento.js";

// El establecimiento llega por query o en el cuerpo. Sin el se asume
// Caspinchango, como en el resto de Producción.
const clave = (valor) => {
  const c = (valor || "").trim();
  return CLAVES.includes(c) ? c : POR_DEFECTO;
};

// El nombre se guarda con los espacios normalizados, tal cual lo escribió el
// usuario en lo demás.
const limpiar = (valor) => (valor || "").trim().replace(/\s+/g, " ");

// Para decidir si un lote ya existe no se compara el texto tal cual: "L 12",
// "l12" y "L-12" son el mismo lote.
const comparable = (valor) =>
  limpiar(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const numero = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const datosDe = (body) => {
  const datos = { nombre: limpiar(body.nombre) };
  if ("hectareas" in body) datos.hectareas = numero(body.hectareas);
  if ("plantas" in body) datos.plantas = numero(body.plantas);
  if ("observaciones" in body) datos.observaciones = (body.observaciones || "").trim();
  return datos;
};

const queFalta = (datos) => {
  if (!datos.nombre) return "Falta el nombre del lote";
  for (const [campo, rotulo] of [
    ["hectareas", "Las hectáreas"],
    ["plantas", "Las plantas"],
  ]) {
    const valor = datos[campo];
    if (valor !== null && valor !== undefined && (!Number.isFinite(valor) || valor < 0)) {
      return `${rotulo} tienen que ser un número de cero para arriba`;
    }
  }
  return null;
};

// El nombre no se repite dentro del mismo campo.
const repetido = async (establecimiento, nombre, ignorarId = null) => {
  const buscado = comparable(nombre);
  if (!buscado) return false;
  const lotes = await Lote.find({
    establecimiento,
    ...(ignorarId ? { _id: { $ne: ignorarId } } : {}),
  })
    .select("nombre")
    .lean();
  return lotes.some((l) => comparable(l.nombre) === buscado);
};

// GET /?establecimiento=san-pablo — ordenados por nombre.
export const getAll = async (req, res) => {
  try {
    const lotes = await Lote.find({ establecimiento: clave(req.query.establecimiento) }).sort({
      nombre: 1,
    });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const establecimiento = clave(req.body.establecimiento);
    const datos = datosDe(req.body);
    const falta = queFalta(datos);
    if (falta) return res.status(400).json({ error: falta });
    if (await repetido(establecimiento, datos.nombre)) {
      return res.status(400).json({ error: "Ya hay un lote con ese nombre en este campo" });
    }
    const lote = await Lote.create({ ...datos, establecimiento });
    res.status(201).json(lote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const actual = await Lote.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "El lote no existe" });

    const datos = datosDe({ ...actual.toObject(), ...req.body });
    const falta = queFalta(datos);
    if (falta) return res.status(400).json({ error: falta });
    if (await repetido(actual.establecimiento, datos.nombre, actual._id)) {
      return res.status(400).json({ error: "Ya hay un lote con ese nombre en este campo" });
    }

    const lote = await Lote.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    });
    res.json(lote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndDelete(req.params.id);
    if (!lote) return res.status(404).json({ error: "El lote no existe" });
    res.json({ message: "Lote eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
