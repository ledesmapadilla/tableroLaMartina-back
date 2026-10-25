import RegistroCambio from "../models/RegistroCambio.js";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILAS = 2000;

// El día en hora argentina (UTC−3): "AAAA-MM-DD" → el instante en que empieza.
const inicioDia = (d) => new Date(`${d}T00:00:00-03:00`);

/**
 * El registro de cambios entre dos días (25/10/2026), lo más nuevo primero.
 * Sin lo que se mandó ni el antes y después: eso lo trae el detalle de cada
 * renglón. Los demás filtros (usuario, sección, acción) los hace la pantalla.
 */
export const getAll = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!DIA.test(desde || "") || !DIA.test(hasta || "")) {
      return res.status(400).json({ error: "Faltan las fechas (desde y hasta)" });
    }
    const fin = inicioDia(hasta);
    fin.setUTCDate(fin.getUTCDate() + 1);
    const filas = await RegistroCambio.find({ fecha: { $gte: inicioDia(desde), $lt: fin } })
      .sort({ fecha: -1 })
      .limit(MAX_FILAS + 1)
      .select("-datos -cambios.doc -cambios.campos.antes -cambios.campos.despues")
      .lean();
    res.json({ filas: filas.slice(0, MAX_FILAS), recortado: filas.length > MAX_FILAS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUno = async (req, res) => {
  try {
    const fila = await RegistroCambio.findById(req.params.id).lean();
    if (!fila) return res.status(404).json({ error: "No está en el registro" });
    res.json(fila);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
