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

// El DNI y el legajo pueden venir vacíos, pero si se cargan no se pueden
// repetir: los dos identifican a la persona y dos filas con el mismo número
// serían la misma persona cargada dos veces.
const repetido = async (campo, valor, ignorarId = null) => {
  const texto = (valor || "").trim();
  if (!texto) return false;
  const filtro = { [campo]: new RegExp(`^${escapar(texto)}$`, "i") };
  if (ignorarId) filtro._id = { $ne: ignorarId };
  return !!(await Personal.findOne(filtro));
};

// Devuelve el error a mostrar, o null si el DNI y el legajo están libres.
const queSeRepite = async (body, ignorarId = null) => {
  if (await repetido("dni", body.dni, ignorarId)) return "Ya existe una persona con ese DNI";
  if (await repetido("legajo", body.legajo, ignorarId)) {
    return "Ya existe una persona con ese legajo";
  }
  return null;
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
    const repetido = await queSeRepite(req.body);
    if (repetido) return res.status(400).json({ error: repetido });

    const persona = new Personal({ ...req.body, apellidoNombre: capitalizar(req.body.apellidoNombre) });
    await persona.save();
    res.status(201).json(persona);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const repetido = await queSeRepite(req.body, req.params.id);
    if (repetido) return res.status(400).json({ error: repetido });

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
