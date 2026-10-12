import mongoose from "mongoose";
import Tractor from "../models/Tractor.js";
import Camioneta from "../models/Camioneta.js";
import Colectivo from "../models/Colectivo.js";
import HorometroTractor from "../models/HorometroTractor.js";
import HistorialTractor from "../models/HistorialTractor.js";
import ServiceTractor from "../models/ServiceTractor.js";
import KilometroColectivo from "../models/KilometroColectivo.js";
import ServiceColectivo from "../models/ServiceColectivo.js";
import Visita from "../models/Visita.js";
import PresupuestoReparacion from "../models/PresupuestoReparacion.js";
import ChequeoSanPablo from "../models/ChequeoSanPablo.js";
import BerdinaPedido from "../models/BerdinaPedido.js";
import SanPabloPedido from "../models/SanPabloPedido.js";
import IngresoSanPablo from "../models/IngresoSanPablo.js";
import { UNIDADES_MANITOU } from "../catalogos/manitous.js";

/**
 * Cambiar el código de un CC (12/10/2026). Varias colecciones guardan una
 * copia del código como texto en vez de apuntar al CC, así que al cambiarlo
 * en Altas se reescribe en todas: lo cargado antes también pasa a leerse con
 * el código nuevo. Lo que apunta por id (partes de Producción, checklists,
 * kilómetros y services de camionetas, ingresos de San Pablo) sigue solo.
 *
 * Única excepción: la fila del historial del tractor que registra un cambio
 * de código conserva los dos valores ("01 → 252"); si no, no diría nada.
 */

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// El código entero, sin distinguir mayúsculas ni espacios de más.
const exacto = (cc) => new RegExp(`^\\s*${escapar(cc.trim())}\\s*$`, "i");

// "CC 158" escrito a mano en un texto, como palabra suelta: no toca "CC 1580".
const enTexto = (cc) => new RegExp(`\\bCC\\s*${escapar(cc.trim())}(?![\\w])`, "gi");

// Dónde está el código como valor de un campo. `array` es la lista que lo
// contiene (los ítems de un pedido).
const CAMPOS = [
  { modelo: Tractor, campo: "cc", label: "Tractor" },
  { modelo: Camioneta, campo: "patente", label: "Camioneta" },
  { modelo: Colectivo, campo: "cc", label: "Colectivo" },
  { modelo: HorometroTractor, campo: "cc", label: "Horómetros" },
  { modelo: HistorialTractor, campo: "cc", label: "Historial del tractor" },
  { modelo: ServiceTractor, campo: "cc", label: "Services del tractor" },
  { modelo: KilometroColectivo, campo: "cc", label: "Kilómetros del colectivo" },
  { modelo: ServiceColectivo, campo: "cc", label: "Services del colectivo" },
  { modelo: Visita, campo: "cc", label: "Visitas" },
  { modelo: PresupuestoReparacion, campo: "cc", label: "Presupuestos de reparaciones" },
  { modelo: ChequeoSanPablo, array: "repuestos", campo: "cc", label: "Repuestos de chequeos San Pablo" },
  { modelo: BerdinaPedido, array: "items", campo: "cc", label: "Ítems de pedidos Berdina" },
  { modelo: SanPabloPedido, array: "items", campo: "cc", label: "Ítems de pedidos San Pablo" },
];

// Donde puede aparecer escrito a mano ("CC 158 sin frenos").
const TEXTOS = [
  { modelo: IngresoSanPablo, campo: "observaciones" },
  { modelo: BerdinaPedido, array: "items", campo: "observaciones" },
  { modelo: SanPabloPedido, array: "items", campo: "observaciones" },
];

// El alta y la baja del historial guardan un resumen del tractor como texto:
// "CC / Tractor: 158 · Grupo: Grupo 1 · …" (historialtractor.controller.js).
const RESUMENES = ["valorAnterior", "valorNuevo"];
const enResumen = (cc) => new RegExp(`CC / Tractor: ${escapar(cc.trim())}(?![\\w])`, "gi");

// Los movimientos del almacén (filtros, aceites y cada rubro) son una
// colección por rubro y todas llevan `cc`: se buscan por nombre.
const coleccionesDeMovimientos = async () =>
  (await mongoose.connection.db.listCollections({ name: /^movimiento/ }).toArray()).map((c) => c.name);

// Los códigos de las Manitou están escritos en el programa (la plantilla de
// General y sus copias): cambiarlos rompería esa pantalla.
export const esCodigoFijo = (cc) => UNIDADES_MANITOU.includes(String(cc || "").trim());

const filtroCampo = ({ array, campo }, re) => ({ [array ? `${array}.${campo}` : campo]: re });

/** Cuántos registros cambian en cada lugar. No escribe nada. */
export const contarRenombre = async (viejo) => {
  const re = exacto(viejo);
  const lugares = [];
  for (const lugar of CAMPOS) {
    const cantidad = await lugar.modelo.countDocuments(filtroCampo(lugar, re));
    if (cantidad) lugares.push({ label: lugar.label, cantidad });
  }
  let almacen = 0;
  for (const nombre of await coleccionesDeMovimientos()) {
    almacen += await mongoose.connection.db.collection(nombre).countDocuments({ cc: re });
  }
  if (almacen) lugares.push({ label: "Movimientos del almacén", cantidad: almacen });

  const reTexto = new RegExp(enTexto(viejo).source, "i");
  let textos = 0;
  for (const lugar of TEXTOS) textos += await lugar.modelo.countDocuments(filtroCampo(lugar, reTexto));
  if (textos) lugares.push({ label: "Observaciones que lo nombran", cantidad: textos });

  const reResumen = new RegExp(enResumen(viejo).source, "i");
  const resumenes = await HistorialTractor.countDocuments({
    accion: { $in: ["alta", "baja"] },
    $or: RESUMENES.map((campo) => ({ [campo]: reResumen })),
  });
  if (resumenes) lugares.push({ label: "Altas y bajas del historial", cantidad: resumenes });

  return lugares;
};

/**
 * Reescribe el código en todos lados, dentro de la sesión (transacción) que
 * se le pasa. El padrón de CC lo cambia quien llama.
 */
export const aplicarRenombre = async (viejo, nuevo, session) => {
  const re = exacto(viejo);
  const opciones = { session };

  for (const lugar of CAMPOS) {
    const coleccion = lugar.modelo.collection;
    if (lugar.array) {
      await coleccion.updateMany(
        filtroCampo(lugar, re),
        { $set: { [`${lugar.array}.$[e].${lugar.campo}`]: nuevo } },
        { ...opciones, arrayFilters: [{ [`e.${lugar.campo}`]: re }] }
      );
    } else {
      await coleccion.updateMany({ [lugar.campo]: re }, { $set: { [lugar.campo]: nuevo } }, opciones);
    }
  }
  for (const nombre of await coleccionesDeMovimientos()) {
    await mongoose.connection.db.collection(nombre).updateMany({ cc: re }, { $set: { cc: nuevo } }, opciones);
  }

  // Los textos se reescriben de a uno: solo cambia la mención, el resto queda.
  const reTexto = enTexto(viejo);
  const reBuscar = new RegExp(reTexto.source, "i");
  const reemplazar = (texto) => (typeof texto === "string" ? texto.replace(reTexto, `CC ${nuevo}`) : texto);
  for (const lugar of TEXTOS) {
    const coleccion = lugar.modelo.collection;
    const docs = await coleccion.find(filtroCampo(lugar, reBuscar), opciones).toArray();
    for (const doc of docs) {
      const set = lugar.array
        ? { [lugar.array]: doc[lugar.array].map((e) => ({ ...e, [lugar.campo]: reemplazar(e[lugar.campo]) })) }
        : { [lugar.campo]: reemplazar(doc[lugar.campo]) };
      await coleccion.updateOne({ _id: doc._id }, { $set: set }, opciones);
    }
  }

  const reResumen = enResumen(viejo);
  const historial = HistorialTractor.collection;
  const altasYBajas = await historial
    .find(
      { accion: { $in: ["alta", "baja"] }, $or: RESUMENES.map((campo) => ({ [campo]: new RegExp(reResumen.source, "i") })) },
      opciones
    )
    .toArray();
  for (const doc of altasYBajas) {
    const set = {};
    for (const campo of RESUMENES) {
      if (typeof doc[campo] === "string") set[campo] = doc[campo].replace(reResumen, `CC / Tractor: ${nuevo}`);
    }
    await historial.updateOne({ _id: doc._id }, { $set: set }, opciones);
  }

  // El cambio queda en el historial del tractor, si es uno.
  const tractor = await Tractor.findOne({ cc: nuevo }, null, opciones);
  if (tractor) {
    await HistorialTractor.create(
      [
        {
          tractor: tractor._id,
          cc: nuevo,
          accion: "modificacion",
          campo: "cc",
          campoLabel: "CC / Tractor",
          valorAnterior: viejo,
          valorNuevo: nuevo,
          fecha: new Date(),
          observaciones: "Código cambiado desde Altas › Centros de costo",
        },
      ],
      opciones
    );
  }
};
