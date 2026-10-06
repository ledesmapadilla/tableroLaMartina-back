import Cliente from "../models/Cliente.js";
import ParteDiario from "../models/ParteDiario.js";
import VariableTarea from "../models/VariableTarea.js";

// La misma cuenta que claveCliente del front (utils/clientes.js).
export const claveCliente = (nombre) =>
  (nombre || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const limpiarNombre = (nombre) => (nombre || "").toString().trim().replace(/\s+/g, " ");

// Partes y precios guardan el nombre como texto: para encontrarlos se compara
// sin mayúsculas ni tildes, igual que la clave del padrón.
const SIN_MAYUSCULAS_NI_TILDES = { locale: "es", strength: 1 };

/**
 * El nombre del padrón para el cliente que llega en un parte o un precio, o
 * null si no está dado de alta. Lo usan partes y variables para no aceptar un
 * cliente que no exista (04/10/2026).
 */
export const clienteDelPadron = async (nombre) => {
  const clave = claveCliente(nombre);
  if (!clave) return null;
  const cliente = await Cliente.findOne({ clave }).select("nombre").lean();
  return cliente?.nombre || null;
};

export const NO_ES_DEL_PADRON = "El cliente no está dado de alta: se agrega en Altas › Clientes";

export const getAll = async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ nombre: 1 }).collation(SIN_MAYUSCULAS_NI_TILDES).lean();
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const armarDatos = (body) => {
  const nombre = limpiarNombre(body.nombre);
  return { nombre, clave: claveCliente(nombre), activo: body.activo !== false && body.activo !== "false" };
};

const repetido = async (clave, ignorarId = null) => {
  const filtro = { clave };
  if (ignorarId) filtro._id = { $ne: ignorarId };
  return Boolean(await Cliente.exists(filtro));
};

export const create = async (req, res) => {
  try {
    const datos = armarDatos(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "Falta el nombre" });
    if (await repetido(datos.clave)) return res.status(400).json({ error: "Ese cliente ya existe" });

    const cliente = await Cliente.create(datos);
    res.status(201).json(cliente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Renombrar un cliente renombra sus partes y sus precios: guardan el nombre,
// y si quedaran con el viejo dejarían de encontrar su precio.
export const update = async (req, res) => {
  try {
    const datos = armarDatos(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "Falta el nombre" });
    if (await repetido(datos.clave, req.params.id)) {
      return res.status(400).json({ error: "Ese cliente ya existe" });
    }

    const anterior = await Cliente.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Cliente no encontrado" });

    const cliente = await Cliente.findByIdAndUpdate(req.params.id, datos, { new: true, runValidators: true });

    if (anterior.nombre !== datos.nombre) {
      const filtro = { cliente: anterior.nombre };
      const opciones = { collation: SIN_MAYUSCULAS_NI_TILDES };
      await Promise.all([
        ParteDiario.updateMany(filtro, { $set: { cliente: datos.nombre } }, opciones),
        VariableTarea.updateMany(filtro, { $set: { cliente: datos.nombre } }, opciones),
      ]);
    }
    res.json(cliente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Un cliente con partes o precios no se borra: esos datos quedarían con un
// cliente que no existe. Para dejar de ofrecerlo está "inactivo".
export const remove = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id).lean();
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    const filtro = { cliente: cliente.nombre };
    const [partes, precios] = await Promise.all([
      ParteDiario.countDocuments(filtro).collation(SIN_MAYUSCULAS_NI_TILDES),
      VariableTarea.countDocuments(filtro).collation(SIN_MAYUSCULAS_NI_TILDES),
    ]);
    if (partes || precios) {
      const usos = [partes && `${partes} partes`, precios && `${precios} precios`].filter(Boolean).join(" y ");
      return res.status(400).json({
        error: `${cliente.nombre} tiene ${usos}: no se puede borrar. Para dejar de ofrecerlo, marcalo como inactivo.`,
      });
    }

    await Cliente.findByIdAndDelete(req.params.id);
    res.json({ message: "Cliente eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
