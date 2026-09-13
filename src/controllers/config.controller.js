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

// Actualiza la config global. El monto de autorización de Compras no entra
// por acá: esta ruta la usa cualquiera, y ese monto solo lo cambian gerente y
// superadmin (ver updateMontoAutorizacion).
export const updateConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) config = await Config.create({});
    const cambios = { ...req.body };
    delete cambios.montoAutorizacion;
    Object.assign(config, cambios);
    await config.save();
    res.json(config);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// Monto desde el que un pedido va a Gerencia. La ruta ya filtra por rol.
export const updateMontoAutorizacion = async (req, res) => {
  try {
    const monto = Number(req.body.montoAutorizacion);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ error: "El monto tiene que ser mayor a cero" });
    }
    let config = await Config.findOne();
    if (!config) config = await Config.create({});
    config.montoAutorizacion = monto;
    await config.save();
    res.json(config);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
