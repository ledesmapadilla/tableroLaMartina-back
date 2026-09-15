import Tractor from "../models/Tractor.js";
import {
  registrarAlta,
  registrarCambios,
  registrarBaja,
} from "./historialtractor.controller.js";
import {
  asegurarCentroCosto,
  sincronizarCentroCosto,
  eliminarCentroCosto,
} from "./centroscosto.controller.js";

// Grupo de la maquina que salio de circulacion. No se lista en ningun lado:
// solo el alta la muestra, para poder volver a asignarla o consultarla.
const GRUPPO_EN_DESUSO = 8;

// Cómo figura la máquina en el padrón de CC. Los camiones cargados acá para
// llevar sus services (cuentan km, como el CC 901) van como "Camión".
const equipoDe = (tractor) => (tractor.unidad === "km" ? "Camión" : "Tractor");

/**
 * Por defecto quedan afuera las maquinas en desuso: se filtra aca, en el unico
 * lugar del que salen los tractores, para que ninguna planilla tenga que
 * acordarse de excluirlas. El alta pide `?incluirDesuso=1` y las recibe.
 */
export const getAll = async (req, res) => {
  try {
    const incluirDesuso = req.query.incluirDesuso === "1";
    const filtro = incluirDesuso ? {} : { gruppo: { $ne: GRUPPO_EN_DESUSO } };
    const tractores = await Tractor.find(filtro).sort({ gruppo: 1, supervisor: 1, cc: 1 });
    res.json(tractores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const tractor = await Tractor.findById(req.params.id);
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    res.json(tractor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const tractor = new Tractor(req.body);
    await tractor.save();
    await registrarAlta(tractor);
    // Todo tractor que se da de alta pasa a ser tambien un CC de Producción.
    await asegurarCentroCosto({
      cc: tractor.cc,
      equipo: equipoDe(tractor),
      descripcion: tractor.descripcion,
      tractor: tractor._id,
    });
    res.status(201).json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    // Se lee el estado previo antes de pisarlo: es lo unico que permite
    // asentar de que valor a que valor se cambio cada campo.
    const anterior = await Tractor.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Tractor no encontrado" });

    const tractor = await Tractor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });

    await registrarCambios(anterior, tractor);
    // El padrón de tractores manda: la edición se refleja en el CC.
    await sincronizarCentroCosto({
      ccAnterior: anterior.cc,
      cc: tractor.cc,
      equipo: equipoDe(tractor),
      descripcion: tractor.descripcion,
      tractor: tractor._id,
    });
    res.json(tractor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const tractor = await Tractor.findByIdAndDelete(req.params.id);
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });
    await registrarBaja(tractor);
    await eliminarCentroCosto({ cc: tractor.cc, equipo: equipoDe(tractor) });
    res.json({ message: "Tractor eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
