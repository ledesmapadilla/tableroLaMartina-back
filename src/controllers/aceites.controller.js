import Aceite from "../models/Aceite.js";
import MovimientoAceite from "../models/MovimientoAceite.js";
import { MOVIMIENTOS } from "../catalogos/almacen.js";

/**
 * Los aceites del almacén: el alta y sus compras y consumos (28/09/2026).
 *
 * Copiado del Sistema de Gestión Lepa y adaptado a cómo se mueve el almacén de
 * repuestos: la existencia es el saldo y ningún movimiento la puede dejar en
 * negativo. La diferencia con los rubros es que se cuenta en litros, con
 * decimales, y por eso la cuenta se redondea a dos.
 */

const BERDINA = "Berdina";

// Dos decimales: con $inc de números con coma quedan colas como 0.30000000004.
const redondear = (n) => Math.round(n * 100) / 100;

// Los litros de un movimiento: un número mayor que cero, o null si no sirve.
const litrosValidos = (valor) => {
  const litros = redondear(Number(valor));
  return Number.isFinite(litros) && litros > 0 ? litros : null;
};

const precioValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;
  const precio = Number(valor);
  return Number.isFinite(precio) && precio >= 0 ? redondear(precio) : null;
};

/**
 * Lo que guarda cada movimiento según sea compra o consumo. Lo que no le
 * corresponde va vacío, así una compra corregida no arrastra un C.C. viejo.
 */
const datosDe = (movimiento, body) => {
  if (movimiento === "Entrada") {
    return {
      proveedor: (body.proveedor || "").trim(),
      marca: (body.marca || "").trim(),
      precio: precioValido(body.precio),
      grupo: "",
      cc: "",
    };
  }
  const grupo = (body.grupo || "").trim();
  return {
    proveedor: "",
    marca: "",
    precio: null,
    grupo,
    cc: grupo === BERDINA ? "" : (body.cc || "").trim(),
  };
};

// Lo que el alta pide sí o sí: lo mismo que en el Sistema de Gestión.
const loQueFalta = (body) => {
  if (!(body.tipo || "").trim()) return "El tipo de aceite es requerido";
  if (!(body.marca || "").trim()) return "La marca es requerida";
  if (!(body.uso || "").trim()) return "El uso es requerido";
  return null;
};

/**
 * Mueve la existencia y avisa si no alcanza.
 *
 * La condición "hay al menos tanto" va adentro del update, así dos consumos a
 * la vez no pueden dejarla en negativo. El update es un pipeline para poder
 * redondear en el mismo paso.
 */
const moverExistencia = async (id, delta) => {
  const condicion = { _id: id };
  if (delta < 0) condicion.existencia = { $gte: -delta };

  const aceite = await Aceite.findOneAndUpdate(
    condicion,
    [{ $set: { existencia: { $round: [{ $add: ["$existencia", delta] }, 2] } } }],
    // Mongoose 9 pide permiso explícito para un update con pipeline.
    { returnDocument: "after", updatePipeline: true }
  );
  if (aceite) return { aceite };

  const existe = await Aceite.findById(id);
  if (!existe) return { error: "Aceite no encontrado", status: 404 };
  return {
    error: `No se pueden sacar ${-delta} L: hay ${existe.existencia} L`,
    status: 400,
  };
};

// ── El alta ──

export const getAll = async (req, res) => {
  try {
    const aceites = await Aceite.find().sort({ tipo: 1, marca: 1 });
    res.json(aceites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const falta = loQueFalta(req.body);
    if (falta) return res.status(400).json({ error: falta });
    const { tipo, marca, denominacion, uso } = req.body;
    // La existencia arranca en cero: la suben las compras.
    const aceite = await Aceite.create({ tipo, marca, denominacion, uso });
    res.status(201).json(aceite);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const falta = loQueFalta(req.body);
    if (falta) return res.status(400).json({ error: falta });
    // La existencia no se edita desde el alta: la mueven los movimientos.
    const { tipo, marca, denominacion, uso } = req.body;
    const aceite = await Aceite.findByIdAndUpdate(
      req.params.id,
      { tipo, marca, denominacion, uso },
      { returnDocument: "after", runValidators: true }
    );
    if (!aceite) return res.status(404).json({ error: "Aceite no encontrado" });
    res.json(aceite);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const aceite = await Aceite.findByIdAndDelete(req.params.id);
    if (!aceite) return res.status(404).json({ error: "Aceite no encontrado" });
    // Las compras y consumos de un aceite que ya no está se van con él, igual
    // que en el Sistema de Gestión, donde vivían adentro del aceite.
    await MovimientoAceite.deleteMany({ aceite: req.params.id });
    res.json({ message: "Aceite eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Compras y consumos ──

// Todos los movimientos, de todos los aceites: la pantalla los muestra juntos
// y los filtra del lado de allá.
export const getMovimientos = async (req, res) => {
  try {
    const movimientos = await MovimientoAceite.find()
      .populate("aceite", "tipo marca denominacion")
      .sort({ fecha: -1, createdAt: -1 });
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addMovimiento = async (req, res) => {
  try {
    const { movimiento, fecha } = req.body;
    if (!MOVIMIENTOS.includes(movimiento)) {
      return res.status(400).json({ error: "El movimiento tiene que ser una compra o un consumo" });
    }
    const litros = litrosValidos(req.body.litros);
    if (!litros) return res.status(400).json({ error: "Los litros tienen que ser un número mayor que cero" });
    if (!fecha) return res.status(400).json({ error: "La fecha es requerida" });

    // La existencia se mueve primero: si no alcanza, no se guarda nada.
    const delta = movimiento === "Entrada" ? litros : -litros;
    const { aceite, error, status } = await moverExistencia(req.params.id, delta);
    if (!aceite) return res.status(status).json({ error });

    try {
      const registrado = await MovimientoAceite.create({
        aceite: aceite._id,
        movimiento,
        fecha,
        litros,
        ...datosDe(movimiento, req.body),
        observaciones: req.body.observaciones,
      });
      res.status(201).json({ movimiento: registrado, aceite });
    } catch (error) {
      // Si el movimiento no se guardó, la existencia vuelve a donde estaba.
      await moverExistencia(aceite._id, -delta);
      throw error;
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Corregir una compra o un consumo.
 *
 * Ni el tipo de movimiento ni el aceite se cambian: lo mal cargado se borra y
 * se carga de nuevo. Si cambian los litros, la existencia se mueve por la
 * diferencia.
 */
export const updateMovimiento = async (req, res) => {
  try {
    const movimiento = await MovimientoAceite.findOne({ _id: req.params.movId, aceite: req.params.id });
    if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });

    const litros = litrosValidos(req.body.litros);
    if (!litros) return res.status(400).json({ error: "Los litros tienen que ser un número mayor que cero" });
    if (!req.body.fecha) return res.status(400).json({ error: "La fecha es requerida" });

    const signo = movimiento.movimiento === "Entrada" ? 1 : -1;
    const delta = redondear(signo * (litros - movimiento.litros));

    let aceite;
    if (delta !== 0) {
      const resultado = await moverExistencia(req.params.id, delta);
      if (!resultado.aceite) return res.status(resultado.status).json({ error: resultado.error });
      aceite = resultado.aceite;
    } else {
      aceite = await Aceite.findById(req.params.id);
    }

    Object.assign(movimiento, {
      fecha: req.body.fecha,
      litros,
      ...datosDe(movimiento.movimiento, req.body),
      observaciones: req.body.observaciones || "",
    });
    await movimiento.save();

    res.json({ movimiento, aceite });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Borrar un movimiento: la existencia vuelve para atrás. Una compra de la que
// ya se consumió no se puede borrar, porque dejaría la existencia en negativo.
export const removeMovimiento = async (req, res) => {
  try {
    const movimiento = await MovimientoAceite.findOne({ _id: req.params.movId, aceite: req.params.id });
    if (!movimiento) return res.status(404).json({ error: "Movimiento no encontrado" });

    const delta = movimiento.movimiento === "Entrada" ? -movimiento.litros : movimiento.litros;
    const { aceite, error, status } = await moverExistencia(req.params.id, delta);
    if (!aceite) {
      return res.status(status).json({
        error: error.replace(
          `No se pueden sacar ${movimiento.litros} L`,
          `No se puede borrar una compra de ${movimiento.litros} L`
        ),
      });
    }

    await movimiento.deleteOne();
    res.json({ message: "Movimiento eliminado", aceite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
