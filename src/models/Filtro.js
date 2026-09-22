import { Schema, model } from "mongoose";
import { RUBROS, tiposDe } from "../catalogos/almacen.js";

/**
 * Los filtros del almacén de repuestos (22/09/2026).
 *
 * Es la primera tarjeta del stock por rubro que tiene pantalla. Cada fila es
 * un filtro del catálogo, no un movimiento: la existencia es el número que hay
 * hoy en el depósito y se corrige a mano.
 *
 * El `codigo` es interno y lo arma el controlador (AIR-001, ACE-012…): sirve
 * para nombrar el filtro en un pedido o en una entrega sin depender del código
 * de fábrica, que a veces no se conoce. El `codigoFabrica` es el que viene
 * impreso en el filtro y lo pone la marca.
 *
 * Los prefijos salen del catálogo del almacén y no de acá: son únicos en todo
 * el proyecto, así ningún otro rubro puede repetir un código de filtro.
 */
export const PREFIJOS = RUBROS.filtros.porTipo;

// El tipo dice "filtro" completo: la columna se lee sola, sin depender del
// título de la pantalla (22/09/2026). Es como ya se nombran en Tractores ›
// Repuestos.
export const TIPOS = tiposDe("filtros");

const FiltroSchema = new Schema(
  {
    // Único en toda la tabla: es con lo que se lo identifica. Una vez puesto no
    // cambia, ni siquiera si después se corrige el tipo (el código ya quedó
    // escrito en el estante y en los pedidos).
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    tipo: { type: String, required: true, enum: TIPOS },
    marca: { type: String, trim: true, default: "" },
    codigoFabrica: { type: String, trim: true, default: "" },
    // Lo que hay en el depósito. Se carga sin saberlo todavía, así que por
    // defecto es cero.
    existencia: { type: Number, default: 0, min: 0 },
    ubicacion: { type: String, trim: true, default: "" },
    observaciones: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default model("Filtro", FiltroSchema);
