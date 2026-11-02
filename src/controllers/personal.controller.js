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

/**
 * Apellido y nombre por separado (02/11/2026): se guardan los dos y el
 * "Apellido, Nombre" de siempre se arma acá, que es lo que muestran todas las
 * pantallas. Sin nombre (Motor Generador) va el apellido solo, sin coma.
 * Devuelve { error } o { apellido, nombre, apellidoNombre }.
 */
const armarNombre = (body, { pideNombre }) => {
  const apellido = capitalizar(String(body.apellido || "").replace(/,/g, " "));
  const nombre = capitalizar(String(body.nombre || "").replace(/,/g, " "));
  if (!apellido) return { error: "El apellido es requerido" };
  if (pideNombre && !nombre) return { error: "El nombre es requerido" };
  return { apellido, nombre, apellidoNombre: nombre ? `${apellido}, ${nombre}` : apellido };
};

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
    const nombres = armarNombre(req.body, { pideNombre: true });
    if (nombres.error) return res.status(400).json({ error: nombres.error });
    const repetido = await queSeRepite(req.body);
    if (repetido) return res.status(400).json({ error: repetido });

    const persona = new Personal({
      ...req.body,
      ...nombres,
      usoInterno: false,
    });
    await persona.save();
    res.status(201).json(persona);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// "Uso interno" no se borra ni se cambia: lo usa la carga de datos.
const USO_INTERNO_FIJO = "Uso interno no se modifica ni se borra: es el de los consumos de gasoil sin persona";

export const update = async (req, res) => {
  try {
    if (await Personal.exists({ _id: req.params.id, usoInterno: true })) {
      return res.status(400).json({ error: USO_INTERNO_FIJO });
    }
    // Al editar el nombre puede quedar vacío: Motor Generador va sin él.
    const nombres = armarNombre(req.body, { pideNombre: false });
    if (nombres.error) return res.status(400).json({ error: nombres.error });
    const repetido = await queSeRepite(req.body, req.params.id);
    if (repetido) return res.status(400).json({ error: repetido });

    // La marca de uso interno no se pone ni se saca desde Altas.
    const { usoInterno: _marca, ...datos } = req.body;
    const persona = await Personal.findByIdAndUpdate(
      req.params.id,
      { ...datos, ...nombres },
      { returnDocument: "after", runValidators: true }
    );
    if (!persona) return res.status(404).json({ error: "Persona no encontrada" });
    res.json(persona);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    if (await Personal.exists({ _id: req.params.id, usoInterno: true })) {
      return res.status(400).json({ error: USO_INTERNO_FIJO });
    }
    const persona = await Personal.findByIdAndDelete(req.params.id);
    if (!persona) return res.status(404).json({ error: "Persona no encontrada" });
    res.json({ message: "Persona eliminada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
