import Tractor from "../models/Tractor.js";
import { registrarCambios } from "./historialtractor.controller.js";
import { sincronizarCentroCosto } from "./centroscosto.controller.js";

// El alta y la baja de un tractor se hacen en Centros de costo: al crear un CC
// de equipo Tractor o Camión aparece acá, y al borrarlo sale (o pasa a "En
// desuso" si tiene historial). Acá solo se administra y se agrupa; el CC no
// se cambia.

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

export const update = async (req, res) => {
  try {
    // Se lee el estado previo antes de pisarlo: es lo unico que permite
    // asentar de que valor a que valor se cambio cada campo.
    const anterior = await Tractor.findById(req.params.id).lean();
    if (!anterior) return res.status(404).json({ error: "Tractor no encontrado" });
    if ("cc" in req.body && String(req.body.cc ?? "").trim() !== anterior.cc) {
      return res.status(400).json({ error: "El CC del tractor no se cambia desde acá" });
    }

    const tractor = await Tractor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tractor) return res.status(404).json({ error: "Tractor no encontrado" });

    await registrarCambios(anterior, tractor);
    // La descripción y si cuenta horas o km se reflejan en el CC.
    await sincronizarCentroCosto({
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
