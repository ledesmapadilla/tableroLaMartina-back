import Proveedor from "../models/Proveedor.js";

const validar = (body, excludeId = null) => {
  const { razonsocial, contacto, rubro, telefono, cuit, email } = body;

  if (!razonsocial?.trim()) return "La razón social es obligatoria.";
  if (!contacto?.trim()) return "El contacto es obligatorio.";
  if (!rubro?.trim()) return "El rubro es obligatorio.";
  if (!telefono?.trim()) return "El teléfono es obligatorio.";
  if (cuit && !/^\d{11}$/.test(cuit)) return "El CUIT debe tener exactamente 11 dígitos numéricos.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El email no tiene un formato válido.";

  return null;
};

export const getAll = async (req, res) => {
  try {
    const proveedores = await Proveedor.find().sort({ createdAt: -1 });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crear = async (req, res) => {
  try {
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });

    const { razonsocial, telefono } = req.body;

    const duplicadoRazon = await Proveedor.findOne({ razonsocial: { $regex: `^${razonsocial.trim()}$`, $options: "i" } });
    if (duplicadoRazon) return res.status(400).json({ error: "Ya existe un proveedor con esa razón social." });

    const duplicadoTel = await Proveedor.findOne({ telefono: telefono.trim() });
    if (duplicadoTel) return res.status(400).json({ error: "Ya existe un proveedor con ese teléfono." });

    const nuevo = await Proveedor.create(req.body);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    const err = validar(req.body);
    if (err) return res.status(400).json({ error: err });

    const { razonsocial, telefono } = req.body;
    const id = req.params.id;

    const duplicadoRazon = await Proveedor.findOne({ razonsocial: { $regex: `^${razonsocial.trim()}$`, $options: "i" }, _id: { $ne: id } });
    if (duplicadoRazon) return res.status(400).json({ error: "Ya existe un proveedor con esa razón social." });

    const duplicadoTel = await Proveedor.findOne({ telefono: telefono.trim(), _id: { $ne: id } });
    if (duplicadoTel) return res.status(400).json({ error: "Ya existe un proveedor con ese teléfono." });

    const updated = await Proveedor.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrar = async (req, res) => {
  try {
    await Proveedor.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
