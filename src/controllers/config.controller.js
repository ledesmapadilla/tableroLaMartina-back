import Config from "../models/Config.js";

// Obtiene la config global (crea el documento si no existe)
export const getConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) config = await Config.create({});
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Actualiza la config global
export const updateConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) config = await Config.create({});
    Object.assign(config, req.body);
    await config.save();
    res.json(config);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
