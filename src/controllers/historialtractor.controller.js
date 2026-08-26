import HistorialTractor from "../models/HistorialTractor.js";

export const GRUPPO_LABELS = {
  1: "Grupo 1",
  2: "Grupo 2",
  3: "Grupo 3",
  4: "Grupo 4",
  5: "Grupo 5",
  6: "Berdina",
  7: "San Pablo",
};

// Campos del alta que se auditan, en el orden en que se muestran en la tabla.
export const CAMPOS_AUDITADOS = [
  { campo: "cc", label: "CC / Tractor" },
  { campo: "gruppo", label: "Grupo" },
  { campo: "supervisor", label: "Supervisor" },
  { campo: "encargadoGral", label: "Encargado Gral." },
  { campo: "descripcion", label: "Descripción / Modelo" },
];

// Los valores se guardan como texto ya formateado: el historial tiene que
// leerse igual aunque despues cambien las etiquetas de los grupos.
export const formatearValor = (campo, valor) => {
  if (valor === null || valor === undefined || valor === "") return "";
  if (campo === "gruppo") {
    const num = Number(valor);
    return GRUPPO_LABELS[num] || `Grupo ${num}`;
  }
  return String(valor).trim();
};

const mismoValor = (campo, a, b) => formatearValor(campo, a) === formatearValor(campo, b);

export const resumenTractor = (doc) =>
  CAMPOS_AUDITADOS.map(({ campo, label }) => {
    const valor = formatearValor(campo, doc?.[campo]);
    return `${label}: ${valor || "—"}`;
  }).join(" · ");

// Alta: una sola fila con el detalle de los valores iniciales.
export const registrarAlta = async (tractorDoc, { fecha, origen = "app", observaciones = "" } = {}) => {
  if (!tractorDoc?._id) return null;
  return HistorialTractor.create({
    tractor: tractorDoc._id,
    cc: tractorDoc.cc,
    accion: "alta",
    campo: "",
    campoLabel: "Alta de tractor",
    valorAnterior: "",
    valorNuevo: resumenTractor(tractorDoc),
    fecha: fecha || tractorDoc.createdAt || new Date(),
    origen,
    observaciones,
  });
};

// Modificacion: una fila por campo que cambio. Si no cambio nada, no escribe.
export const registrarCambios = async (anterior, nuevo, { fecha, origen = "app", observaciones = "" } = {}) => {
  if (!nuevo?._id) return [];

  const filas = CAMPOS_AUDITADOS.filter(({ campo }) => !mismoValor(campo, anterior?.[campo], nuevo?.[campo])).map(
    ({ campo, label }) => ({
      tractor: nuevo._id,
      // El CC anterior es el que identificaba al tractor cuando se hizo el cambio.
      cc: anterior?.cc || nuevo.cc,
      accion: "modificacion",
      campo,
      campoLabel: label,
      valorAnterior: formatearValor(campo, anterior?.[campo]),
      valorNuevo: formatearValor(campo, nuevo?.[campo]),
      fecha: fecha || new Date(),
      origen,
      observaciones,
    })
  );

  if (filas.length === 0) return [];
  return HistorialTractor.insertMany(filas);
};

// Baja: se conserva el registro aunque el tractor ya no exista.
export const registrarBaja = async (tractorDoc, { fecha, origen = "app", observaciones = "" } = {}) => {
  if (!tractorDoc?._id) return null;
  return HistorialTractor.create({
    tractor: tractorDoc._id,
    cc: tractorDoc.cc,
    accion: "baja",
    campo: "",
    campoLabel: "Baja de tractor",
    valorAnterior: resumenTractor(tractorDoc),
    valorNuevo: "",
    fecha: fecha || new Date(),
    origen,
    observaciones,
  });
};

export const getAll = async (req, res) => {
  try {
    const historial = await HistorialTractor.find()
      .populate("tractor", "cc descripcion")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialPorTractor = async (req, res) => {
  try {
    const historial = await HistorialTractor.find({ tractor: req.params.tractorId }).sort({
      fecha: -1,
      createdAt: -1,
    });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const eliminar = async (req, res) => {
  try {
    const registro = await HistorialTractor.findByIdAndDelete(req.params.id);
    if (!registro) return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ message: "Registro eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
