import mongoose from "mongoose";
import Tarea from "../models/Tarea.js";
import VariableTarea from "../models/VariableTarea.js";

// Los nombres se escriben de mil formas distintas ("Riego", "riegos",
// " RIEGO ", "Riegó"). Para decidir si una tarea ya existe no se compara el
// texto tal cual sino esta clave, que ignora mayúsculas, acentos, espacios de
// sobra y la diferencia entre singular y plural.
const clave = (valor) =>
  (valor || "")
    .normalize("NFD") // separa la letra de su acento para poder sacarlo
    .replace(/\p{Diacritic}/gu, "") // saca los acentos que quedaron sueltos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // signos de puntuación: como si fueran espacios
    .trim()
    .split(/\s+/) // colapsa espacios de adelante, del medio y del final
    .map(singular)
    .join(" ");

// Plural del español, con las reglas que alcanzan para un padrón de tareas:
// "plantas" → "planta", "árboles" → "arbol", "raíces" → "raiz".
function singular(palabra) {
  if (palabra.length > 4 && palabra.endsWith("ces")) return `${palabra.slice(0, -3)}z`;
  if (palabra.length > 4 && palabra.endsWith("es")) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
}

// El nombre se guarda con los espacios ya normalizados, tal cual lo escribió
// el usuario en lo demás.
const limpiar = (valor) => (valor || "").trim().replace(/\s+/g, " ");

// La comparación es en memoria: el padrón de tareas es chico y la clave no se
// puede armar con una consulta de Mongo.
const tareaRepetida = async (tarea, ignorarId = null) => {
  const buscada = clave(tarea);
  if (!buscada) return false;

  const tareas = await Tarea.find(ignorarId ? { _id: { $ne: ignorarId } } : {})
    .select("tarea")
    .lean();

  return tareas.some((t) => clave(t.tarea) === buscada);
};

/**
 * "Mismo precio que" (07/11/2026): el id de la otra tarea, o null. Devuelve
 * { valor } o { error }. No se encadena (la otra no puede cobrar a su vez
 * como una tercera, ni esta ser la de otra), va en la misma unidad y la
 * tarea no puede tener precios propios cargados: no se usarían nunca.
 */
const mismoPrecioValido = async (valor, idPropio = null, unidad = "") => {
  if (valor === undefined || valor === null || valor === "") return { valor: null };
  if (!mongoose.isValidObjectId(valor)) return { error: "La tarea de «Mismo precio que» no es válida" };
  if (idPropio && String(valor) === String(idPropio)) {
    return { error: "Una tarea no puede tener el mismo precio que ella misma" };
  }
  const otra = await Tarea.findById(valor).select("tarea unidad mismoPrecioQue").lean();
  if (!otra) return { error: "La tarea de «Mismo precio que» no está dada de alta" };
  if (otra.mismoPrecioQue) {
    return { error: `«${otra.tarea}» ya toma el precio de otra tarea: elegí esa otra` };
  }
  if ((otra.unidad || "").trim() !== (unidad || "").trim()) {
    return { error: `«${otra.tarea}» va en ${otra.unidad}: con distinta unidad no puede ser el mismo precio` };
  }
  if (idPropio) {
    const [laUsan, conPrecios] = await Promise.all([
      Tarea.exists({ mismoPrecioQue: idPropio }),
      VariableTarea.exists({ tarea: idPropio }),
    ]);
    if (laUsan) return { error: "Otra tarea toma el precio de esta: no puede tomar a su vez el de otra" };
    if (conPrecios) {
      return { error: "Esta tarea tiene precios cargados en Variables: borralos antes, o no se usarían nunca" };
    }
  }
  return { valor: otra._id };
};

export const getAll = async (req, res) => {
  try {
    const tareas = await Tarea.find().sort({ tarea: 1 }).lean();
    res.json(tareas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const tarea = await Tarea.findById(req.params.id);
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json(tarea);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    if (!(req.body.unidad || "").trim()) {
      return res.status(400).json({ error: "La unidad es obligatoria" });
    }
    if (await tareaRepetida(req.body.tarea)) {
      return res.status(400).json({ error: "Ya existe una tarea con ese nombre" });
    }
    const mismo = await mismoPrecioValido(req.body.mismoPrecioQue, null, req.body.unidad);
    if (mismo.error) return res.status(400).json({ error: mismo.error });
    const tarea = new Tarea({ ...req.body, tarea: limpiar(req.body.tarea), mismoPrecioQue: mismo.valor });
    await tarea.save();
    res.status(201).json(tarea);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    if (!(req.body.unidad || "").trim()) {
      return res.status(400).json({ error: "La unidad es obligatoria" });
    }
    if (await tareaRepetida(req.body.tarea, req.params.id)) {
      return res.status(400).json({ error: "Ya existe una tarea con ese nombre" });
    }
    // Solo se toca si viene en el pedido: otra pantalla que edite la tarea no
    // le saca el «Mismo precio que».
    const cambiaMismo = Object.prototype.hasOwnProperty.call(req.body, "mismoPrecioQue");
    const mismo = cambiaMismo
      ? await mismoPrecioValido(req.body.mismoPrecioQue, req.params.id, req.body.unidad)
      : {};
    if (mismo.error) return res.status(400).json({ error: mismo.error });
    // Si la que la usa cambia de unidad, deja de ser el mismo precio.
    const laUsan = await Tarea.find({ mismoPrecioQue: req.params.id }).select("tarea unidad").lean();
    const otraUnidad = laUsan.find((t) => (t.unidad || "").trim() !== (req.body.unidad || "").trim());
    if (otraUnidad) {
      return res.status(400).json({
        error: `«${otraUnidad.tarea}» toma el precio de esta y va en ${otraUnidad.unidad}: no se le puede cambiar la unidad`,
      });
    }
    const tarea = await Tarea.findByIdAndUpdate(
      req.params.id,
      { ...req.body, tarea: limpiar(req.body.tarea), ...(cambiaMismo ? { mismoPrecioQue: mismo.valor } : {}) },
      { new: true, runValidators: true }
    );
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json(tarea);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    // Una tarea de la que otra toma el precio no se borra: la otra se
    // quedaría sin precio sin que nadie se entere.
    const laUsa = await Tarea.findOne({ mismoPrecioQue: req.params.id }).select("tarea").lean();
    if (laUsa) {
      return res.status(400).json({
        error: `«${laUsa.tarea}» toma el precio de esta tarea: sacale «Mismo precio que» antes de borrarla`,
      });
    }
    const tarea = await Tarea.findByIdAndDelete(req.params.id);
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json({ message: "Tarea eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
