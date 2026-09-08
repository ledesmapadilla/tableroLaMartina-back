import Usuario from "../models/Usuario.js";

export const getAll = async (req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crear = async (req, res) => {
  try {
    const nuevo = await Usuario.create(req.body);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const updated = await Usuario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrar = async (req, res) => {
  try {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
