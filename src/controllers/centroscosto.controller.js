import CentroCosto from "../models/CentroCosto.js";

// Equipos cuyo padron NO se maneja desde Producción: el alta, la edicion y la
// baja mandan desde su propia pantalla y acá solo se refleja el resultado.
export const EQUIPOS_GESTIONADOS = {
  Tractor: "Tractores",
  Camioneta: "Camionetas",
};

const esGestionado = (equipo) =>
  Object.prototype.hasOwnProperty.call(EQUIPOS_GESTIONADOS, (equipo || "").trim());

const avisoGestionado = (equipo) =>
  `Los CC de tipo ${(equipo || "").trim()} se dan de alta en la pantalla de ${
    EQUIPOS_GESTIONADOS[(equipo || "").trim()]
  }`;

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Coincidencia exacta de CC sin distinguir mayusculas ni espacios de mas, que
// es como lo escribe el usuario en la pantalla de altas.
const filtroPorCC = (cc) => ({ cc: new RegExp(`^${escapar((cc || "").trim())}$`, "i") });

// El CC es la identificacion del centro de costos: no se permite repetirlo.
const yaExiste = async (cc, ignorarId = null) => {
  const valor = (cc || "").trim();
  if (!valor) return false;
  const filtro = filtroPorCC(valor);
  if (ignorarId) filtro._id = { $ne: ignorarId };
  return !!(await CentroCosto.findOne(filtro));
};

// ── Sincronizacion desde las pantallas que mandan (Tractores, Camionetas) ──
// Las tres funciones son tolerantes a fallos: un error replicando el CC nunca
// debe voltear el alta, la edicion o la baja que las llamó.

// Alta. Idempotente: si el CC ya figura en el listado no se duplica.
export const asegurarCentroCosto = async ({ cc, equipo = "", descripcion = "" }) => {
  try {
    const valor = (cc || "").trim();
    if (!valor) return null;
    if (await yaExiste(valor)) return null;
    return await CentroCosto.create({ cc: valor, equipo, descripcion });
  } catch (error) {
    console.error("No se pudo replicar el alta del CC:", error.message);
    return null;
  }
};

// Edicion. Busca por el CC anterior porque la identificacion misma pudo haber
// cambiado; si todavia no existia el CC (equipo dado de alta antes de esta
// sincronizacion), lo crea.
export const sincronizarCentroCosto = async ({ ccAnterior, cc, equipo = "", descripcion = "" }) => {
  try {
    const anterior = (ccAnterior || "").trim();
    const nuevo = (cc || "").trim();
    if (!nuevo) return null;

    const existente = anterior ? await CentroCosto.findOne(filtroPorCC(anterior)) : null;
    if (!existente) {
      return await asegurarCentroCosto({ cc: nuevo, equipo, descripcion });
    }

    existente.cc = nuevo;
    existente.equipo = equipo;
    existente.descripcion = descripcion || "";
    return await existente.save();
  } catch (error) {
    console.error("No se pudo replicar la edición del CC:", error.message);
    return null;
  }
};

// Baja. Solo borra el CC si sigue siendo del equipo que lo generó, para no
// llevarse puesto un CC que el usuario haya reconvertido a mano.
export const eliminarCentroCosto = async ({ cc, equipo = "" }) => {
  try {
    const valor = (cc || "").trim();
    if (!valor) return null;
    return await CentroCosto.findOneAndDelete({ ...filtroPorCC(valor), equipo });
  } catch (error) {
    console.error("No se pudo replicar la baja del CC:", error.message);
    return null;
  }
};

// ── CRUD de la pantalla de Producción ──

export const getAll = async (req, res) => {
  try {
    const centros = await CentroCosto.find().sort({ cc: 1 });
    res.json(centros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const centro = await CentroCosto.findById(req.params.id);
    if (!centro) return res.status(404).json({ error: "CC no encontrado" });
    res.json(centro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    if (esGestionado(req.body.equipo)) {
      return res.status(400).json({ error: avisoGestionado(req.body.equipo) });
    }
    if (await yaExiste(req.body.cc)) {
      return res.status(400).json({ error: "Ya existe un CC con ese código" });
    }
    const centro = new CentroCosto(req.body);
    await centro.save();
    res.status(201).json(centro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const actual = await CentroCosto.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "CC no encontrado" });

    // Ni los CC que ya vienen de otra pantalla se editan acá, ni se puede
    // convertir un CC propio en uno de esos equipos.
    if (esGestionado(actual.equipo)) {
      return res.status(400).json({ error: avisoGestionado(actual.equipo) });
    }
    if (esGestionado(req.body.equipo)) {
      return res.status(400).json({ error: avisoGestionado(req.body.equipo) });
    }
    if (await yaExiste(req.body.cc, req.params.id)) {
      return res.status(400).json({ error: "Ya existe un CC con ese código" });
    }

    const centro = await CentroCosto.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(centro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const actual = await CentroCosto.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "CC no encontrado" });
    if (esGestionado(actual.equipo)) {
      return res.status(400).json({ error: avisoGestionado(actual.equipo) });
    }

    await CentroCosto.findByIdAndDelete(req.params.id);
    res.json({ message: "CC eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
