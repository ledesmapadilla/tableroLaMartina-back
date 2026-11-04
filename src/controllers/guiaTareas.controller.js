import GuiaTarea from "../models/GuiaTarea.js";
import Tarea from "../models/Tarea.js";

const limpiar = (valor) => (valor || "").toString().trim().replace(/\s+/g, " ");

// Lo mismo valida el alta y el cambio: descripción y una tarea que exista.
// Devuelve el error o los datos limpios.
const validar = async (body) => {
  const descripcion = limpiar(body.descripcion);
  if (!descripcion) return { error: "La descripción del trabajo es obligatoria" };
  if (!body.tarea || !(await Tarea.exists({ _id: body.tarea }))) {
    return { error: "Elegí una tarea del padrón" };
  }
  return { datos: { descripcion, tarea: body.tarea, observaciones: limpiar(body.observaciones) } };
};

export const getAll = async (req, res) => {
  try {
    const guia = await GuiaTarea.find().populate("tarea", "tarea unidad").sort({ descripcion: 1 }).lean();
    res.json(guia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const { error, datos } = await validar(req.body);
    if (error) return res.status(400).json({ error });
    const trabajo = await GuiaTarea.create(datos);
    await trabajo.populate("tarea", "tarea unidad");
    res.status(201).json(trabajo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const { error, datos } = await validar(req.body);
    if (error) return res.status(400).json({ error });
    const trabajo = await GuiaTarea.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    }).populate("tarea", "tarea unidad");
    if (!trabajo) return res.status(404).json({ error: "Trabajo no encontrado" });
    res.json(trabajo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const trabajo = await GuiaTarea.findByIdAndDelete(req.params.id);
    if (!trabajo) return res.status(404).json({ error: "Trabajo no encontrado" });
    res.json({ message: "Trabajo eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
