import Tarea from "../models/Tarea.js";

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

export const getAll = async (req, res) => {
  try {
    const tareas = await Tarea.find().sort({ tarea: 1 });
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
    const tarea = new Tarea({ ...req.body, tarea: limpiar(req.body.tarea) });
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
    const tarea = await Tarea.findByIdAndUpdate(
      req.params.id,
      { ...req.body, tarea: limpiar(req.body.tarea) },
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
    const tarea = await Tarea.findByIdAndDelete(req.params.id);
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json({ message: "Tarea eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
