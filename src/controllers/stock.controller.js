import ArticuloStock from "../models/ArticuloStock.js";
import MovimientoStock from "../models/MovimientoStock.js";

/**
 * El stock del almacén (20/09/2026).
 *
 * La regla de la casa: **el saldo de un artículo solo cambia por un
 * movimiento**. Por eso el PUT del artículo no toca `cantidad` aunque venga en
 * el cuerpo, y la única forma de moverla es POST .../movimientos. Si no, el
 * historial deja de explicar el número y no sirve para nada.
 */

// El nombre sin acentos ni mayúsculas, para no dar de alta dos veces lo mismo.
const normalizar = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const soloDatos = ({ nombre, seccion, unidad, minimo, ubicacion, precio }) => {
  const datos = {};
  if (nombre !== undefined) datos.nombre = String(nombre).trim();
  if (seccion !== undefined) datos.seccion = String(seccion).trim();
  if (unidad !== undefined) datos.unidad = String(unidad).trim();
  if (minimo !== undefined) datos.minimo = Math.max(0, Number(minimo) || 0);
  if (ubicacion !== undefined) datos.ubicacion = String(ubicacion).trim();
  if (precio !== undefined && precio !== null && precio !== "") datos.precio = Number(precio);
  return datos;
};

export const getAll = async (req, res) => {
  try {
    const articulos = await ArticuloStock.find().sort({ nombre: 1 }).lean();
    res.json(articulos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crear = async (req, res) => {
  try {
    const datos = soloDatos(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "El artículo necesita un nombre." });

    // Dos fichas del mismo repuesto arruinan el stock: se avisa en vez de
    // dejar duplicar.
    const existentes = await ArticuloStock.find({}, { nombre: 1 }).lean();
    const repetido = existentes.find((a) => normalizar(a.nombre) === normalizar(datos.nombre));
    if (repetido) {
      return res.status(409).json({ error: `"${repetido.nombre}" ya está en el catálogo.`, id: repetido._id });
    }

    // Nace en cero: si viene con cantidad, entra como movimiento para que
    // quede en la historia.
    const articulo = await new ArticuloStock({ ...datos, cantidad: 0 }).save();

    const inicial = Math.max(0, Number(req.body?.cantidad) || 0);
    if (inicial > 0) {
      await moverArticulo({
        articulo,
        tipo: "entrada",
        cantidad: inicial,
        nota: req.body?.nota || "Carga inicial",
        usuario: req.usuario?.nombre || "",
      });
      articulo.cantidad = inicial;
    }

    res.status(201).json(articulo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const actualizar = async (req, res) => {
  try {
    // `cantidad` no entra: el saldo se mueve solo con movimientos.
    const articulo = await ArticuloStock.findByIdAndUpdate(req.params.id, soloDatos(req.body), {
      new: true,
      runValidators: true,
    });
    if (!articulo) return res.status(404).json({ error: "Artículo no encontrado." });
    res.json(articulo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const borrar = async (req, res) => {
  try {
    const articulo = await ArticuloStock.findByIdAndDelete(req.params.id);
    if (!articulo) return res.status(404).json({ error: "Artículo no encontrado." });
    await MovimientoStock.deleteMany({ articulo: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMovimientos = async (req, res) => {
  try {
    const movimientos = await MovimientoStock.find({ articulo: req.params.id })
      .sort({ fecha: -1 })
      .lean();
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mueve el saldo y deja el movimiento. El saldo se toca con `$inc` (entrada y
 * salida) para que dos personas moviendo el mismo artículo a la vez no se
 * pisen; la salida además pide que haya suficiente, así no queda en negativo.
 */
const moverArticulo = async ({ articulo, tipo, cantidad, taller, persona, nota, usuario }) => {
  let actualizado;

  if (tipo === "entrada") {
    actualizado = await ArticuloStock.findByIdAndUpdate(
      articulo._id,
      { $inc: { cantidad } },
      { new: true }
    );
  } else if (tipo === "salida") {
    actualizado = await ArticuloStock.findOneAndUpdate(
      { _id: articulo._id, cantidad: { $gte: cantidad } },
      { $inc: { cantidad: -cantidad } },
      { new: true }
    );
    if (!actualizado) {
      const error = new Error(`No hay suficiente: quedan ${articulo.cantidad}.`);
      error.status = 409;
      throw error;
    }
  } else {
    // El ajuste nace de contar: `cantidad` es el saldo que queda.
    actualizado = await ArticuloStock.findByIdAndUpdate(
      articulo._id,
      { $set: { cantidad } },
      { new: true }
    );
  }

  const movimiento = await new MovimientoStock({
    articulo: articulo._id,
    tipo,
    // En el ajuste se guarda la diferencia, que es lo que se lee en el
    // historial ("+3", "-2"); en los demás, lo que entró o salió.
    cantidad: tipo === "ajuste" ? actualizado.cantidad - articulo.cantidad : cantidad,
    saldo: actualizado.cantidad,
    taller: taller || "",
    persona: persona || "",
    nota: nota || "",
    usuario: usuario || "",
  }).save();

  return { articulo: actualizado, movimiento };
};

export const registrarMovimiento = async (req, res) => {
  try {
    const { tipo, cantidad, taller, persona, nota } = req.body || {};
    if (!["entrada", "salida", "ajuste"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de movimiento inválido." });
    }
    const valor = Number(cantidad);
    if (!Number.isFinite(valor) || valor < 0 || (tipo !== "ajuste" && valor <= 0)) {
      return res.status(400).json({ error: "Indicá una cantidad válida." });
    }

    const articulo = await ArticuloStock.findById(req.params.id);
    if (!articulo) return res.status(404).json({ error: "Artículo no encontrado." });

    const { articulo: actualizado } = await moverArticulo({
      articulo,
      tipo,
      cantidad: valor,
      taller,
      persona,
      nota,
      usuario: req.usuario?.nombre || "",
    });

    res.json(actualizado);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};
