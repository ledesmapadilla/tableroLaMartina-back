import Personal from "../models/Personal.js";

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


// Los nombres se cargan de planillas escritas todas en mayúsculas. Se guardan
// con la inicial de cada palabra en mayúscula y el resto en minúscula, que es
// como se listan en pantalla.
const capitalizar = (valor) =>
  (valor || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s,.\-])(\p{L})/gu, (m, separador, letra) => separador + letra.toUpperCase());

// El DNI identifica a la persona: es obligatorio y no se permite repetirlo.
const dniRepetido = async (dni, ignorarId = null) => {
  const valor = (dni || "").trim();
  if (!valor) return false;
  const filtro = { dni: new RegExp(`^${escapar(valor)}$`, "i") };
  if (ignorarId) filtro._id = { $ne: ignorarId };
  return !!(await Personal.findOne(filtro));
};

export const getAll = async (req, res) => {
  try {
    const personal = await Personal.find().sort({ apellidoNombre: 1 });
    res.json(personal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const persona = await Personal.findById(req.params.id);
    if (!persona) return res.status(404).json({ error: "Persona no encontrada" });
    res.json(persona);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    if (!(req.body.dni || "").trim()) {
      return res.status(400).json({ error: "El DNI es obligatorio" });
    }
    if (await dniRepetido(req.body.dni)) {
      return res.status(400).json({ error: "Ya existe una persona con ese DNI" });
    }
    const persona = new Personal({ ...req.body, apellidoNombre: capitalizar(req.body.apellidoNombre) });
    await persona.save();
    res.status(201).json(persona);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    if (!(req.body.dni || "").trim()) {
      return res.status(400).json({ error: "El DNI es obligatorio" });
    }
    if (await dniRepetido(req.body.dni, req.params.id)) {
      return res.status(400).json({ error: "Ya existe una persona con ese DNI" });
    }
    const persona = await Personal.findByIdAndUpdate(
      req.params.id,
      { ...req.body, apellidoNombre: capitalizar(req.body.apellidoNombre) },
      { new: true, runValidators: true }
    );
    if (!persona) return res.status(404).json({ error: "Persona no encontrada" });
    res.json(persona);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const persona = await Personal.findByIdAndDelete(req.params.id);
    if (!persona) return res.status(404).json({ error: "Persona no encontrada" });
    res.json({ message: "Persona eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
