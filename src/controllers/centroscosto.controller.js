import CentroCosto from "../models/CentroCosto.js";
import Tractor from "../models/Tractor.js";
import Camioneta from "../models/Camioneta.js";
import Colectivo from "../models/Colectivo.js";
import ParteDiario from "../models/ParteDiario.js";
import TrabajoTractor from "../models/TrabajoTractor.js";
import HorometroTractor from "../models/HorometroTractor.js";
import ServiceTractor from "../models/ServiceTractor.js";
import CambioHorometro from "../models/CambioHorometro.js";
import TrabajoCamioneta from "../models/TrabajoCamioneta.js";
import Parada from "../models/Parada.js";
import Service from "../models/Service.js";
import CheckList from "../models/CheckList.js";
import Kilometro from "../models/Kilometro.js";
import ServiceColectivo from "../models/ServiceColectivo.js";
import KilometroColectivo from "../models/KilometroColectivo.js";
import { registrarAlta, registrarCambios, registrarBaja } from "./historialtractor.controller.js";

// El padrón de CC es la única puerta de entrada (15/09/2026). Un CC cuyo
// equipo es de Flota se da de alta y de baja acá, y la unidad aparece sola en
// su pantalla, donde solo se la administra y se la agrupa.
export const EQUIPOS_FLOTA = {
  Tractor: "Tractores",
  // Los camiones (como el CC 901) se llevan en Tractores, contando km.
  Camión: "Tractores",
  Camioneta: "Camionetas",
  Colectivo: "Colectivos",
};

const pantallaDeEquipo = (equipo) => EQUIPOS_FLOTA[(equipo || "").trim()] || null;

// Qué pantalla de Flota tiene la unidad de un CC ya guardado. El enlace al
// tractor manda sobre el equipo escrito.
const pantallaQueManda = (centro) => (centro.tractor ? "Tractores" : pantallaDeEquipo(centro.equipo));

// El grupo "En desuso" de los tractores (ver models/Tractor.js).
const GRUPPO_EN_DESUSO = 8;

// Los grupos en los que puede nacer un tractor: 1 a 5, Berdina y San Pablo.
// Se elige al dar de alta el CC; "En desuso" no es un alta.
const grupoDeAlta = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n < GRUPPO_EN_DESUSO ? n : null;
};
const avisoGrupo = { error: "Elegí el grupo del tractor" };

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Coincidencia exacta de CC sin distinguir mayusculas ni espacios de mas, que
// es como lo escribe el usuario en la pantalla de altas.
const regexCC = (cc) => new RegExp(`^${escapar((cc || "").trim())}$`, "i");
const filtroPorCC = (cc) => ({ cc: regexCC(cc) });

// Camionetas y colectivos se identifican por la patente, que va en mayúsculas.
const codigoPara = (cc, equipo) => {
  const valor = (cc || "").trim();
  return ["Camioneta", "Colectivo"].includes((equipo || "").trim()) ? valor.toUpperCase() : valor;
};

// El CC es la identificacion del centro de costos: no se permite repetirlo.
const yaExiste = async (cc, ignorarId = null) => {
  const valor = (cc || "").trim();
  if (!valor) return false;
  const filtro = filtroPorCC(valor);
  if (ignorarId) filtro._id = { $ne: ignorarId };
  return !!(await CentroCosto.findOne(filtro));
};

// ── La unidad de Flota de un CC ──

// Crea la unidad en su pantalla. Si ya había una con ese código (un tractor
// en desuso, una carga vieja) se la reutiliza en vez de duplicarla. El tractor
// nace en el grupo que se eligió en el alta.
const crearUnidad = async (centro, { gruppo } = {}) => {
  const equipo = (centro.equipo || "").trim();
  const pantalla = pantallaDeEquipo(equipo);

  if (pantalla === "Tractores") {
    let tractor = await Tractor.findOne(filtroPorCC(centro.cc));
    if (!tractor) {
      tractor = await Tractor.create({
        cc: centro.cc,
        descripcion: centro.descripcion || "",
        unidad: equipo === "Camión" ? "km" : "hs",
        gruppo,
      });
      await registrarAlta(tractor);
    } else if (gruppo && tractor.gruppo !== gruppo) {
      // Uno que vuelve (por ejemplo, desde "En desuso") va al grupo elegido.
      const anterior = tractor.toObject();
      tractor.gruppo = gruppo;
      await tractor.save();
      await registrarCambios(anterior, tractor);
    }
    centro.tractor = tractor._id;
    await centro.save();
  } else if (pantalla === "Camionetas") {
    const existe = await Camioneta.findOne({ patente: regexCC(centro.cc) });
    // La marca y el modelo se completan en Camionetas; hasta entonces va la
    // descripción del CC.
    if (!existe) await Camioneta.create({ patente: centro.cc, marca: centro.descripcion || "" });
  } else if (pantalla === "Colectivos") {
    const existe = await Colectivo.findOne(filtroPorCC(centro.cc));
    if (!existe) await Colectivo.create({ cc: centro.cc, descripcion: centro.descripcion || "" });
  }
};

const buscarUnidad = async (centro) => {
  const pantalla = pantallaQueManda(centro);
  let doc = null;
  if (pantalla === "Tractores") {
    doc = centro.tractor ? await Tractor.findById(centro.tractor) : await Tractor.findOne(filtroPorCC(centro.cc));
  } else if (pantalla === "Camionetas") {
    doc = await Camioneta.findOne({ patente: regexCC(centro.cc) });
  } else if (pantalla === "Colectivos") {
    doc = await Colectivo.findOne(filtroPorCC(centro.cc));
  }
  return doc ? { pantalla, doc } : null;
};

// Lo que cuenta como historia de cada unidad: con algo de esto no se borra.
const HISTORIAL = {
  Tractores: (id) =>
    [TrabajoTractor, HorometroTractor, ServiceTractor, CambioHorometro].map((M) => M.countDocuments({ tractor: id })),
  Camionetas: (id) =>
    [TrabajoCamioneta, Parada, Service, CheckList, Kilometro].map((M) => M.countDocuments({ camioneta: id })),
  Colectivos: (id) => [ServiceColectivo, KilometroColectivo].map((M) => M.countDocuments({ colectivo: id })),
};

const tieneHistorial = async (unidad) =>
  unidad ? (await Promise.all(HISTORIAL[unidad.pantalla](unidad.doc._id))).some((n) => n > 0) : false;

// Lo que la ficha de Flota le pasa a su CC: la descripción y, en los
// tractores, si cuenta horas o km (Tractor o Camión). El código no: es del
// padrón y no cambia. Tolerante a fallos: nunca voltea la edición que lo llamó.
export const sincronizarCentroCosto = async ({ cc, equipo, descripcion = "", tractor = null }) => {
  try {
    const existente = await CentroCosto.findOne(filtroPorCC(cc));
    if (!existente) return null;
    existente.equipo = equipo;
    existente.descripcion = descripcion || "";
    if (tractor) existente.tractor = tractor;
    return await existente.save();
  } catch (error) {
    console.error("No se pudo replicar la edición del CC:", error.message);
    return null;
  }
};

// ── CRUD del padrón ──

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

// Los campos que mantiene Compras. Se pueden editar en cualquier CC, también
// en uno de Flota: el grupo y la marca son datos de compras, no del equipo.
const CAMPOS_COMPRAS = ["grupo", "marca", "observaciones"];

// Los que describen al equipo. En un CC de Flota quedan fijos: horómetros,
// services e historial guardan una copia del código, y la descripción se edita
// en la ficha de Flota.
const CAMPOS_EQUIPO = ["cc", "equipo", "descripcion"];

const limpiar = (v) => String(v ?? "").trim();

export const create = async (req, res) => {
  try {
    const equipo = limpiar(req.body.equipo);
    const cc = codigoPara(req.body.cc, equipo);
    const gruppo = grupoDeAlta(req.body.gruppo);
    if (pantallaDeEquipo(equipo) === "Tractores" && !gruppo) {
      return res.status(400).json(avisoGrupo);
    }
    if (await yaExiste(cc)) {
      return res.status(400).json({ error: "Ya existe un CC con ese código" });
    }
    const datos = { cc, equipo, descripcion: limpiar(req.body.descripcion) };
    for (const campo of CAMPOS_COMPRAS) datos[campo] = limpiar(req.body[campo]);
    const centro = await CentroCosto.create(datos);

    try {
      await crearUnidad(centro, { gruppo });
    } catch (error) {
      // Sin la unidad el CC quedaría a medias: se deshace el alta.
      await CentroCosto.findByIdAndDelete(centro._id);
      return res
        .status(400)
        .json({ error: `No se pudo agregar a ${pantallaDeEquipo(equipo)}: ${error.message}` });
    }
    res.status(201).json(centro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const actual = await CentroCosto.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "CC no encontrado" });

    const cambios = {};
    for (const campo of CAMPOS_COMPRAS) {
      if (campo in req.body) cambios[campo] = limpiar(req.body[campo]);
    }

    const pantalla = pantallaQueManda(actual);
    if (pantalla) {
      // Se avisa solo si de verdad se intentó cambiar algo del equipo: el
      // front manda solo los datos de Compras y no tendría por qué fallar.
      const cambiaAlgo = CAMPOS_EQUIPO.some(
        (campo) => campo in req.body && limpiar(req.body[campo]) !== limpiar(actual[campo])
      );
      if (cambiaAlgo) {
        return res.status(400).json({
          error: `El CC ${actual.cc} es de ${pantalla}: el código y el equipo no se cambian, y la descripción se edita en ${pantalla}.`,
        });
      }
    } else {
      const equipo = "equipo" in req.body ? limpiar(req.body.equipo) : actual.equipo;
      if ("equipo" in req.body) cambios.equipo = equipo;
      if ("descripcion" in req.body) cambios.descripcion = limpiar(req.body.descripcion);
      if ("cc" in req.body || "equipo" in req.body) {
        const cc = codigoPara("cc" in req.body ? req.body.cc : actual.cc, equipo);
        if (await yaExiste(cc, req.params.id)) {
          return res.status(400).json({ error: "Ya existe un CC con ese código" });
        }
        cambios.cc = cc;
      }
    }

    // Un CC suelto que pasa a ser un tractor también necesita su grupo.
    const gruppo = grupoDeAlta(req.body.gruppo);
    if (!pantalla && pantallaDeEquipo(cambios.equipo ?? actual.equipo) === "Tractores" && !gruppo) {
      return res.status(400).json(avisoGrupo);
    }

    const centro = await CentroCosto.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    });

    // Un CC del padrón que pasa a ser de Flota (por ejemplo, un colectivo que
    // cargó Compras sin equipo) se agrega a su pantalla.
    if (!pantalla && pantallaDeEquipo(centro.equipo)) {
      try {
        await crearUnidad(centro, { gruppo });
      } catch (error) {
        await CentroCosto.findByIdAndUpdate(req.params.id, {
          cc: actual.cc,
          equipo: actual.equipo,
          descripcion: actual.descripcion,
        });
        return res
          .status(400)
          .json({ error: `No se pudo agregar a ${pantallaDeEquipo(centro.equipo)}: ${error.message}` });
      }
    }
    res.json(centro);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// La baja es solo desde acá. Sin historia se borran el CC y su unidad. Con
// historia no se borra nada: el tractor pasa a "En desuso" (sale de las
// planillas y conserva lo cargado) y el CC queda, porque los partes de
// Producción lo referencian; una camioneta, un colectivo o un CC con partes no
// se pueden borrar.
export const remove = async (req, res) => {
  try {
    const actual = await CentroCosto.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "CC no encontrado" });

    const unidad = await buscarUnidad(actual);
    const partes = await ParteDiario.countDocuments({ cc: actual._id });
    const conHistorial = partes > 0 || (await tieneHistorial(unidad));

    if (conHistorial) {
      if (unidad?.pantalla === "Tractores" && unidad.doc.gruppo !== GRUPPO_EN_DESUSO) {
        const anterior = unidad.doc.toObject();
        unidad.doc.gruppo = GRUPPO_EN_DESUSO;
        await unidad.doc.save();
        await registrarCambios(anterior, unidad.doc);
        return res.json({
          desuso: true,
          message: `El CC ${actual.cc} tiene historial: no se borra. El tractor pasó a "En desuso" y el CC queda en el padrón.`,
        });
      }
      const donde = unidad ? ` en ${unidad.pantalla}` : "";
      return res.status(400).json({
        error: `El CC ${actual.cc} tiene historial${partes ? " (partes de Producción)" : donde}: no se puede borrar.`,
      });
    }

    if (unidad) {
      await unidad.doc.deleteOne();
      if (unidad.pantalla === "Tractores") await registrarBaja(unidad.doc);
    }
    await CentroCosto.findByIdAndDelete(actual._id);
    res.json({ message: "CC eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
