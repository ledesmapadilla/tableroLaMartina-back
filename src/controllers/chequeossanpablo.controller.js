import ChequeoSanPablo from "../models/ChequeoSanPablo.js";
import SanPabloPedido from "../models/SanPabloPedido.js";

// Las tablas de cada sistema de Manitous › General (06/10/2026). Las filas
// las carga el taller; desde cada una se piden repuestos, que entran a
// Compras como un pedido de San Pablo del grupo Manitou.

const SECCIONES = ["manitous-general"];
const SISTEMAS = [
  "motor",
  "tren-delantero",
  "tren-trasero",
  "torre",
  "sistema-hidraulico",
  "sistema-electrico",
  "cabina",
  "otros",
];
const URGENCIAS = ["Baja", "Media", "Alta", "Crítica"];

const limpiar = (v) => String(v ?? "").trim();

// "AAAA-MM-DD" de hoy en Argentina, como en los pedidos de San Pablo.
const hoyArgentina = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

const claveDe = (fuente) => {
  const cosecha = Number(fuente.cosecha);
  const seccion = limpiar(fuente.seccion);
  const sistema = limpiar(fuente.sistema);
  if (!Number.isInteger(cosecha) || cosecha < 2027) return { error: "Cosecha inválida" };
  if (!SECCIONES.includes(seccion)) return { error: "Sección inválida" };
  if (!SISTEMAS.includes(sistema)) return { error: "Sistema inválido" };
  return { cosecha, seccion, sistema };
};

export const getChequeos = async (req, res) => {
  try {
    const clave = claveDe(req.query);
    if (clave.error) return res.status(400).json(clave);
    const filas = await ChequeoSanPablo.find(clave).sort({ createdAt: 1 }).lean();
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createChequeo = async (req, res) => {
  try {
    const clave = claveDe(req.body);
    if (clave.error) return res.status(400).json(clave);
    const item = limpiar(req.body.item);
    if (!item) return res.status(400).json({ error: "Poné el ítem" });
    const fila = await ChequeoSanPablo.create({ ...clave, item });
    res.status(201).json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// El ítem, el chequeado y la tarea. Una x necesita el problema escrito; un ok
// lo borra.
export const updateChequeo = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    const body = req.body;
    if ("item" in body) {
      const item = limpiar(body.item);
      if (!item) return res.status(400).json({ error: "Poné el ítem" });
      fila.item = item;
    }
    if ("chequeado" in body) fila.chequeado = Boolean(body.chequeado);
    if ("problema" in body) fila.problema = limpiar(body.problema);
    if ("tarea" in body) {
      const tarea = body.tarea || null;
      if (![null, "ok", "x"].includes(tarea)) return res.status(400).json({ error: "Tarea inválida" });
      fila.tarea = tarea;
      if (tarea !== "x") fila.problema = "";
    }
    if (fila.tarea === "x" && !fila.problema) {
      return res.status(400).json({ error: "Escribí el problema" });
    }
    await fila.save();
    res.json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Los pedidos que ya salieron quedan en Compras.
export const removeChequeo = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findByIdAndDelete(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Repuestos de una fila ──
// Guardar los anota en la fila sin pedirlos; Pedir crea un pedido de San
// Pablo con un ítem del grupo Manitou, en "Para analisis" como uno cargado en
// Compras. Uno guardado se puede corregir, pedir más tarde o borrar; uno ya
// pedido queda fijo (su estado se sigue en Compras).

const datosRepuesto = (body) => {
  const datos = {
    nombre_repuesto: limpiar(body.nombre_repuesto),
    cant: Number(body.cant),
    unidad: limpiar(body.unidad),
    cc: limpiar(body.cc),
    urgencia: limpiar(body.urgencia),
    descripcion: limpiar(body.descripcion),
  };
  if (!datos.nombre_repuesto) return { error: "Poné el nombre del repuesto" };
  if (!Number.isFinite(datos.cant) || datos.cant < 1) return { error: "La cantidad tiene que ser 1 o más" };
  if (!datos.unidad) return { error: "Poné la unidad" };
  if (!datos.cc) return { error: "Elegí el C.C." };
  if (!URGENCIAS.includes(datos.urgencia)) return { error: "Elegí la urgencia" };
  return { datos };
};

const crearPedido = async (datos, solicita) =>
  new SanPabloPedido({
    fecha: hoyArgentina(),
    // El número lleva una R en Compras (SP-R045).
    origen: "reparaciones",
    items: [
      {
        ...datos,
        grupo: "Manitou",
        origen: "reparaciones",
        ...(solicita ? { solicita } : {}),
        historial: [{ estado: "Para analisis", usuario: solicita || "Sistema", nota: "Pedido creado" }],
      },
    ],
  }).save();

// POST: un repuesto nuevo, guardado o pedido según `pedir`.
export const agregarRepuesto = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    const { datos, error } = datosRepuesto(req.body);
    if (error) return res.status(400).json({ error });

    const solicita = limpiar(req.usuario?.nombre);
    const repuesto = { ...datos, solicita };
    if (req.body.pedir) {
      const pedido = await crearPedido(datos, solicita);
      Object.assign(repuesto, { pedido: pedido._id, nro_pedido: pedido.nro_pedido, fecha: new Date() });
    }
    fila.repuestos.push(repuesto);
    await fila.save();
    res.status(201).json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PUT: corrige uno guardado y, con `pedir`, lo pide.
export const actualizarRepuesto = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    const repuesto = fila?.repuestos.id(req.params.repuestoId);
    if (!repuesto) return res.status(404).json({ error: "Repuesto no encontrado" });
    if (repuesto.pedido) return res.status(400).json({ error: "Ese repuesto ya se pidió: se sigue en Compras" });
    const { datos, error } = datosRepuesto(req.body);
    if (error) return res.status(400).json({ error });

    const solicita = limpiar(req.usuario?.nombre);
    Object.assign(repuesto, datos);
    if (req.body.pedir) {
      const pedido = await crearPedido(datos, solicita);
      Object.assign(repuesto, { pedido: pedido._id, nro_pedido: pedido.nro_pedido, solicita, fecha: new Date() });
    }
    await fila.save();
    res.json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE: solo uno guardado; lo pedido ya está en Compras.
export const borrarRepuesto = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    const repuesto = fila?.repuestos.id(req.params.repuestoId);
    if (!repuesto) return res.status(404).json({ error: "Repuesto no encontrado" });
    if (repuesto.pedido) return res.status(400).json({ error: "Ese repuesto ya se pidió: se sigue en Compras" });
    repuesto.deleteOne();
    await fila.save();
    res.json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
