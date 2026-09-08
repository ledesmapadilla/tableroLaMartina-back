import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

export const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password)
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });

    const user = await Usuario.findOne({ usuario, activo: true });
    if (!user || user.password !== password)
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, usuario: user.usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, nombre: user.nombre, usuario: user.usuario, rol: user.rol });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
