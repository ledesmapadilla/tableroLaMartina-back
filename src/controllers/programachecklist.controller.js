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

export const upsertEstado = async (req, res) => {
  try {
    const { camionetaId, año, mes, estado, puntuacion, camionetatParada } = req.body;
    const programa = await ProgramaCheckList.findOneAndUpdate(
      { camioneta: camionetaId, año: Number(año) },
      { $set: { [`${mes}.estado`]: estado, [`${mes}.puntuacion`]: puntuacion ?? null, [`${mes}.camionetatParada`]: !!camionetatParada } },
      { new: true, upsert: true }
    ).populate("camioneta", "marca patente");
    res.json(programa);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
