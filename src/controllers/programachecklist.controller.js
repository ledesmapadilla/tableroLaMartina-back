import ProgramaCheckList from "../models/ProgramaCheckList.js";

export const getByAño = async (req, res) => {
  try {
    const programas = await ProgramaCheckList.find({ año: Number(req.params.año) })
      .populate("camioneta", "marca patente");
    res.json(programas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTareasPendientesCount = async (req, res) => {
  try {
    const año = new Date().getFullYear();
    const count = await ProgramaCheckList.countDocuments({
      año,
      $or: [
        { "enero.tareaPendiente": true },
        { "marzo.tareaPendiente": true },
        { "mayo.tareaPendiente": true },
        { "julio.tareaPendiente": true },
        { "septiembre.tareaPendiente": true },
        { "noviembre.tareaPendiente": true },
      ],
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteByAño = async (req, res) => {
  try {
    const { camionetaId, año } = req.params;
    const result = await ProgramaCheckList.findOneAndDelete({ camioneta: camionetaId, año: Number(año) });
    if (!result) return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const upsertEstado = async (req, res) => {
  try {
    const { camionetaId, año, mes, estado, puntuacion, camionetatParada, tareaPendiente } = req.body;
    const programa = await ProgramaCheckList.findOneAndUpdate(
      { camioneta: camionetaId, año: Number(año) },
      { $set: { [`${mes}.estado`]: estado, [`${mes}.puntuacion`]: puntuacion ?? null, [`${mes}.camionetatParada`]: !!camionetatParada, [`${mes}.tareaPendiente`]: !!tareaPendiente } },
      { new: true, upsert: true }
    ).populate("camioneta", "marca patente");
    res.json(programa);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
