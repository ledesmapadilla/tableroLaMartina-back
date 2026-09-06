import mongoose from "mongoose";
import DescuentoPersonal from "../models/DescuentoPersonal.js";

// Los montos llegan del formulario: vacío es cero, no null, porque acá un
// descuento sin cargar y uno de cero valen lo mismo.
const aNumero = (valor) => {
  if (valor === "" || valor === undefined || valor === null) return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

// Todos los descuentos de un mes, para pintar la columna del informe de una
// sola consulta.
export const getDelPeriodo = async (req, res) => {
  try {
    const { anio, mes } = req.params;
    const descuentos = await DescuentoPersonal.find({
      anio: Number(anio),
      mes: Number(mes),
    });
    res.json(descuentos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Alta y edición en una sola ruta: la pantalla no distingue entre cargar el
// descuento por primera vez y corregirlo, y no hay una lista de descuentos a
// la que agregar filas.
//
// Solo se pisan los campos que llegan en el cuerpo: los importes y el ojo se
// guardan por separado desde la misma pantalla, y ninguno tiene que borrar lo
// que cargó el otro.
export const guardar = async (req, res) => {
  try {
    const { anio, mes, persona } = req.params;
    if (!mongoose.isValidObjectId(persona)) {
      return res.status(400).json({ error: "Persona inválida" });
    }

    const cambios = {};
    if ("descAntic" in req.body) cambios.descAntic = aNumero(req.body.descAntic);
    if ("retJudicial" in req.body) cambios.retJudicial = aNumero(req.body.retJudicial);
    if ("excluido" in req.body) cambios.excluido = Boolean(req.body.excluido);

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: "No hay nada que guardar" });
    }

    const descuento = await DescuentoPersonal.findOneAndUpdate(
      { anio: Number(anio), mes: Number(mes), persona },
      { $set: cambios },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(descuento);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
