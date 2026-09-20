import mongoose from "mongoose";

/**
 * Un artículo del almacén (20/09/2026).
 *
 * El catálogo crece con el uso: cuando al analista le llega algo que no está,
 * lo da de alta en el mismo paso en que lo ingresa. Por eso el artículo es una
 * ficha que existe aunque la cantidad sea cero, y lo que se sigue en el tiempo
 * es esa ficha.
 *
 * `cantidad` es el saldo. Nunca se escribe a mano desde la pantalla: lo mueven
 * los movimientos (MovimientoStock), que son los que cuentan por qué llegó a
 * ese número.
 *
 * `precio` es el último precio conocido. Queda para valorizar el depósito el
 * día que haga falta; hoy no lo usa ninguna pantalla.
 */
const articuloStockSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    // La sección es el mismo grupo con el que se pide un repuesto en Compras
    // (front: utils/equipos.js), así lo comprado para Manitou entra al stock
    // de Manitou sin traducir nada. Va como texto: la lista se toca seguido.
    seccion: { type: String, trim: true, default: "Otros", index: true },
    unidad: { type: String, trim: true, default: "un" },
    cantidad: { type: Number, default: 0, min: 0 },
    // Desde este número el artículo se marca en falta. Cero es "no avisar".
    minimo: { type: Number, default: 0, min: 0 },
    ubicacion: { type: String, trim: true, default: "" },
    precio: { type: Number },
  },
  { timestamps: true }
);

// Se busca por nombre todo el tiempo, y se usa para no duplicar en el alta.
articuloStockSchema.index({ nombre: 1 });

export default mongoose.model("ArticuloStock", articuloStockSchema, "articulosstock");
