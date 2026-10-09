import ChequeoSanPablo from "../models/ChequeoSanPablo.js";
import SanPabloPedido from "../models/SanPabloPedido.js";
import PresupuestoReparacion from "../models/PresupuestoReparacion.js";
import OC from "../models/OC.js";
import {
  SECCIONES_MANITOU,
  SECCION_GENERAL,
  UNIDADES_MANITOU,
  seccionDeUnidad,
  unidadDeSeccion,
} from "../catalogos/manitous.js";

// Las tablas de cada sistema de las Manitous (06/10/2026). Desde el
// 09/10/2026 Manitous › General es la plantilla: ahí se cargan los ítems y
// los repuestos, y cada cambio se copia a todas las Manitou (catalogos/
// manitous.js). En cada Manitou se trabaja: OK, problemas, cantidades,
// cotizar y pedir; los repuestos pedidos entran a Compras como un pedido de
// San Pablo del grupo Manitou.

const SECCIONES = SECCIONES_MANITOU;
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
  if (!Number.isInteger(cosecha) || cosecha < 2026) return { error: "Cosecha inválida" };
  if (!SECCIONES.includes(seccion)) return { error: "Sección inválida" };
  if (!SISTEMAS.includes(sistema)) return { error: "Sistema inválido" };
  return { cosecha, seccion, sistema };
};

// ── General → cada Manitou ──

const esGeneral = (fila) => fila.seccion === SECCION_GENERAL;
const SOLO_GENERAL = "Los ítems y los repuestos se cargan en Manitous › General";
const SOLO_UNIDAD = "General es la plantilla: esto se hace en cada Manitou";

// Los repuestos mandados a cotizar, de entre estos ids.
// Sin ids no se consulta: cada viaje a la base cuenta (09/10/2026).
const cotizadosDe = async (ids) =>
  ids.length
    ? new Set((await PresupuestoReparacion.find({ repuesto: { $in: ids } }).distinct("repuesto")).map(String))
    : new Set();

// Deja la copia de una fila de General en cada Manitou igual a ella: el
// ítem y los repuestos (nombre, unidad, urgencia y descripción). La
// cantidad es de cada Manitou y el C.C. es el de la unidad; lo pedido ya no
// se toca. Un repuesto borrado en General se va de las copias, salvo que ya
// se haya pedido o mandado a cotizar: ese queda suelto en su Manitou.
export const replicar = async (general) => {
  const copias = await ChequeoSanPablo.find({ origen: general._id });
  const deGeneral = new Set(general.repuestos.map((r) => String(r._id)));
  const sobrantes = copias.flatMap((c) => c.repuestos.filter((r) => r.origen && !deGeneral.has(String(r.origen))));
  const cotizados = await cotizadosDe(sobrantes.map((r) => r._id));

  // Las copias se arman en memoria y se guardan todas juntas, en paralelo:
  // de a una eran cinco viajes a la base seguidos (09/10/2026).
  const aGuardar = [];
  for (const nro of UNIDADES_MANITOU) {
    const seccion = seccionDeUnidad(nro);
    const copia =
      copias.find((c) => c.seccion === seccion) ||
      new ChequeoSanPablo({ cosecha: general.cosecha, seccion, sistema: general.sistema, origen: general._id });
    copia.item = general.item;
    copia.descripcion = general.descripcion;

    for (const g of general.repuestos) {
      const datos = {
        nombre_repuesto: g.nombre_repuesto,
        unidad: g.unidad,
        urgencia: g.urgencia,
        descripcion: g.descripcion,
      };
      const r = copia.repuestos.find((x) => String(x.origen) === String(g._id));
      if (!r) copia.repuestos.push({ ...datos, cant: g.cant, cc: nro, solicita: g.solicita, origen: g._id });
      else if (!r.pedido) Object.assign(r, datos);
    }
    for (const r of [...copia.repuestos]) {
      if (!r.origen || deGeneral.has(String(r.origen))) continue;
      if (r.pedido || cotizados.has(String(r._id))) r.origen = null;
      else r.deleteOne();
    }
    if (copia.isNew || copia.isModified()) aGuardar.push(copia);
  }
  await Promise.all(aGuardar.map((c) => c.save()));
};

// Al borrar una fila de General: sus copias se van, salvo las que tienen
// problemas cargados o algún repuesto pedido o mandado a cotizar, que quedan
// sueltas en su Manitou (y ahí se pueden borrar).
const soltarCopias = async (general) => {
  const copias = await ChequeoSanPablo.find({ origen: general._id });
  const cotizados = await cotizadosDe(copias.flatMap((c) => c.repuestos.map((r) => r._id)));
  await Promise.all(
    copias.map((c) => {
      const conAlgo =
        problemasDe(c).length > 0 || c.repuestos.some((r) => r.pedido || cotizados.has(String(r._id)));
      if (!conAlgo) return c.deleteOne();
      c.origen = null;
      for (const r of c.repuestos) r.origen = null;
      return c.save();
    })
  );
};

// ── Problemas ──
// Una fila tiene una lista de problemas, cada uno con su círculo de resuelto
// (08/10/2026). Con problemas, el OK no se marca a mano: es OK cuando están
// todos resueltos. Sin problemas, el OK se marca como siempre.
//
// Las filas de antes tenían un problema solo (`problema` + la x en `tarea`):
// se leen como un problema de la lista, resuelto si la x estaba sacada.
const problemasDe = (fila) => {
  if (fila.problemas?.length || !fila.problema) return fila.problemas || [];
  return [{ _id: "0", texto: fila.problema, resuelto: fila.tarea !== "x" }];
};

// Pasa una fila vieja al formato nuevo, antes de tocarle los problemas.
const pasarANuevo = (fila) => {
  if (!fila.problemas.length && fila.problema) {
    fila.problemas.push({ texto: fila.problema, resuelto: fila.tarea !== "x" });
  }
  fila.problema = "";
  fila.tarea = null;
};

// Con problemas, el OK sale de ellos.
const sincronizarOk = (fila) => {
  if (fila.problemas.length) fila.chequeado = fila.problemas.every((p) => p.resuelto);
};

const conProblemas = (fila) => {
  const o = typeof fila.toObject === "function" ? fila.toObject() : fila;
  return { ...o, problemas: problemasDe(o) };
};

// Sin `sistema` trae todos los de la sección (09/10/2026): la página de una
// Manitou, con los ocho sistemas, en un solo pedido.
export const getChequeos = async (req, res) => {
  try {
    const clave = req.query.sistema ? claveDe(req.query) : claveDe({ ...req.query, sistema: SISTEMAS[0] });
    if (!req.query.sistema && !clave.error) delete clave.sistema;
    if (clave.error) return res.status(400).json(clave);
    const filas = await ChequeoSanPablo.find(clave).sort({ createdAt: 1 }).lean();
    res.json(filas.map(conProblemas));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createChequeo = async (req, res) => {
  try {
    const clave = claveDe(req.body);
    if (clave.error) return res.status(400).json(clave);
    if (clave.seccion !== SECCION_GENERAL) return res.status(400).json({ error: SOLO_GENERAL });
    const item = limpiar(req.body.item);
    if (!item) return res.status(400).json({ error: "Poné el ítem" });
    const fila = await ChequeoSanPablo.create({ ...clave, item, descripcion: limpiar(req.body.descripcion) });
    await replicar(fila);
    res.status(201).json(conProblemas(fila));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// El ítem, el chequeado y la tarea. Una x necesita el problema escrito.
// Sacar la x no borra lo escrito (queda para cuando se la vuelva a marcar);
// el texto se borra solo mandando `problema` vacío.
export const updateChequeo = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    const body = req.body;
    // En General solo el ítem y su descripción; en una Manitou todo menos eso.
    const general = esGeneral(fila);
    if (general && ["chequeado", "problema", "tarea"].some((c) => c in body)) {
      return res.status(400).json({ error: SOLO_UNIDAD });
    }
    if (!general && ("item" in body || "descripcion" in body)) return res.status(400).json({ error: SOLO_GENERAL });
    if ("descripcion" in body) fila.descripcion = limpiar(body.descripcion);
    if ("item" in body) {
      const item = limpiar(body.item);
      if (!item) return res.status(400).json({ error: "Poné el ítem" });
      fila.item = item;
    }
    // Con problemas el OK no se toca a mano: sale de los resueltos.
    if ("chequeado" in body && problemasDe(fila).length === 0) fila.chequeado = Boolean(body.chequeado);
    if ("problema" in body) fila.problema = limpiar(body.problema);
    if ("tarea" in body) {
      const tarea = body.tarea || null;
      if (![null, "ok", "x"].includes(tarea)) return res.status(400).json({ error: "Tarea inválida" });
      fila.tarea = tarea;
    }
    // OK y Con problema se excluyen (08/10/2026): lo que se acaba de marcar
    // desmarca al otro. El problema escrito no se borra.
    if (fila.chequeado && fila.tarea === "x") {
      if (body.tarea === "x") fila.chequeado = false;
      else fila.tarea = null;
    }
    if (fila.tarea === "x" && !fila.problema) {
      return res.status(400).json({ error: "Escribí el problema" });
    }
    await fila.save();
    if (general) await replicar(fila);
    res.json(conProblemas(fila));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// POST { texto, duracion? }: un problema nuevo, sin resolver; la fila deja de estar OK.
export const agregarProblema = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    if (esGeneral(fila)) return res.status(400).json({ error: SOLO_UNIDAD });
    const texto = limpiar(req.body.texto);
    if (!texto) return res.status(400).json({ error: "Escribí el problema" });
    pasarANuevo(fila);
    fila.problemas.push({ texto, duracion: limpiar(req.body.duracion) });
    sincronizarOk(fila);
    await fila.save();
    res.status(201).json(conProblemas(fila));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PUT { texto?, resuelto?, duracion? }: lo corrige o lo marca resuelto (o no).
export const actualizarProblema = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    if (esGeneral(fila)) return res.status(400).json({ error: SOLO_UNIDAD });
    pasarANuevo(fila);
    // Una fila vieja recién pasada no tenía id: se la busca por posición.
    const problema = fila.problemas.id(req.params.problemaId) || (req.params.problemaId === "0" ? fila.problemas[0] : null);
    if (!problema) return res.status(404).json({ error: "Problema no encontrado" });
    if ("texto" in req.body) {
      const texto = limpiar(req.body.texto);
      if (!texto) return res.status(400).json({ error: "Escribí el problema" });
      problema.texto = texto;
    }
    if ("resuelto" in req.body) problema.resuelto = Boolean(req.body.resuelto);
    if ("duracion" in req.body) problema.duracion = limpiar(req.body.duracion);
    sincronizarOk(fila);
    await fila.save();
    res.json(conProblemas(fila));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrarProblema = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    if (esGeneral(fila)) return res.status(400).json({ error: SOLO_UNIDAD });
    pasarANuevo(fila);
    const problema = fila.problemas.id(req.params.problemaId) || (req.params.problemaId === "0" ? fila.problemas[0] : null);
    if (!problema) return res.status(404).json({ error: "Problema no encontrado" });
    problema.deleteOne();
    sincronizarOk(fila);
    await fila.save();
    res.json(conProblemas(fila));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Los pedidos que ya salieron quedan en Compras. Borrar en General borra las
// copias (ver soltarCopias); en una Manitou solo se borra una fila suelta.
export const removeChequeo = async (req, res) => {
  try {
    const fila = await ChequeoSanPablo.findById(req.params.id);
    if (!fila) return res.status(404).json({ error: "Fila no encontrada" });
    if (fila.origen) return res.status(400).json({ error: SOLO_GENERAL });
    if (esGeneral(fila)) await soltarCopias(fila);
    await fila.deleteOne();
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
//
// En General se cargan, corrigen y borran, y cada cambio se copia a las
// Manitou; ahí no se piden ni llevan C.C. En una Manitou, de un repuesto
// copiado solo se cambia la cantidad, y el C.C. es siempre el de la unidad.

const cantidadDe = (body) => {
  const cant = Number(body.cant);
  return Number.isFinite(cant) && cant >= 1 ? cant : null;
};

const datosRepuesto = (body, cc) => {
  const datos = {
    nombre_repuesto: limpiar(body.nombre_repuesto),
    cant: cantidadDe(body),
    unidad: limpiar(body.unidad),
    cc,
    urgencia: limpiar(body.urgencia),
    descripcion: limpiar(body.descripcion),
  };
  if (!datos.nombre_repuesto) return { error: "Poné el nombre del repuesto" };
  if (datos.cant === null) return { error: "La cantidad tiene que ser 1 o más" };
  if (!datos.unidad) return { error: "Poné la unidad" };
  if (!URGENCIAS.includes(datos.urgencia)) return { error: "Elegí la urgencia" };
  return { datos };
};

// Lo que va al pedido: los datos del repuesto, sin lo de la fila.
const paraPedido = (r) => ({
  nombre_repuesto: r.nombre_repuesto,
  cant: r.cant,
  unidad: r.unidad,
  cc: r.cc,
  urgencia: r.urgencia,
  descripcion: r.descripcion,
});

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
    if (!esGeneral(fila)) return res.status(400).json({ error: SOLO_GENERAL });
    if (req.body.pedir) return res.status(400).json({ error: SOLO_UNIDAD });
    const { datos, error } = datosRepuesto(req.body, "");
    if (error) return res.status(400).json({ error });

    fila.repuestos.push({ ...datos, solicita: limpiar(req.usuario?.nombre) });
    await fila.save();
    await replicar(fila);
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
    const general = esGeneral(fila);
    if (general && req.body.pedir) return res.status(400).json({ error: SOLO_UNIDAD });

    if (repuesto.origen) {
      // Copiado de General: acá solo la cantidad.
      const cant = cantidadDe(req.body);
      if (cant === null) return res.status(400).json({ error: "La cantidad tiene que ser 1 o más" });
      repuesto.cant = cant;
    } else {
      const { datos, error } = datosRepuesto(req.body, general ? "" : unidadDeSeccion(fila.seccion));
      if (error) return res.status(400).json({ error });
      Object.assign(repuesto, datos);
    }

    if (req.body.pedir) {
      const solicita = limpiar(req.usuario?.nombre);
      const pedido = await crearPedido(paraPedido(repuesto), solicita);
      Object.assign(repuesto, { pedido: pedido._id, nro_pedido: pedido.nro_pedido, solicita, fecha: new Date() });
    }
    await fila.save();
    if (general) await replicar(fila);
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
    if (repuesto.origen) return res.status(400).json({ error: SOLO_GENERAL });
    repuesto.deleteOne();
    await fila.save();
    if (esGeneral(fila)) await replicar(fila);
    res.json(fila);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── Gasto real (09/10/2026) ──
// GET ?cosecha=: los repuestos de las Manitou que se pidieron a Compras, cada
// uno con lo que se pagó en las órdenes de pago (sin IVA, como la OP). Un
// pedido comprado en partes tiene más de un ítem de OP: se suman. Lo usa la
// comparación con el presupuesto, en Manitous › General › Presupuesto.
export const getGastoReal = async (req, res) => {
  try {
    const cosecha = Number(req.query.cosecha);
    if (!Number.isInteger(cosecha)) return res.status(400).json({ error: "Cosecha inválida" });
    const filas = await ChequeoSanPablo.find({
      cosecha,
      seccion: { $in: UNIDADES_MANITOU.map(seccionDeUnidad) },
      "repuestos.pedido": { $type: "objectId" },
    })
      .select("seccion sistema item repuestos")
      .lean();
    const pedidos = filas.flatMap((f) => f.repuestos.filter((r) => r.pedido).map((r) => ({ f, r })));
    const ids = new Set(pedidos.map(({ r }) => String(r.pedido)));

    const porPedido = new Map();
    const ocs = ids.size ? await OC.find({ "items.pedidoId": { $in: [...ids] } }).select("nro_oc_display fecha items").lean() : [];
    for (const oc of ocs) {
      for (const it of oc.items) {
        if (!ids.has(it.pedidoId)) continue;
        const total = it.precio_total ?? (it.precio_unitario || 0) * (it.cant || 0);
        if (!porPedido.has(it.pedidoId)) porPedido.set(it.pedidoId, []);
        porPedido.get(it.pedidoId).push({
          op: oc.nro_oc_display,
          fecha: it.fecha || oc.fecha,
          proveedor: it.proveedor,
          cant: it.cant,
          precio_unitario: it.precio_unitario,
          total,
        });
      }
    }

    res.json(
      pedidos.map(({ f, r }) => {
        const ops = porPedido.get(String(r.pedido)) || [];
        return {
          unidad: unidadDeSeccion(f.seccion),
          sistema: f.sistema,
          item: f.item,
          repuesto: r._id,
          nombre_repuesto: r.nombre_repuesto,
          unidad_medida: r.unidad,
          nro_pedido: r.nro_pedido,
          ops,
          total: ops.reduce((acc, o) => acc + (o.total || 0), 0),
        };
      })
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
