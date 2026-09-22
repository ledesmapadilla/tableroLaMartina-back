import Filtro, { TIPOS, PREFIJOS } from "../models/Filtro.js";
import MovimientoFiltro from "../models/MovimientoFiltro.js";
import { crearRubro } from "./rubroStock.js";

/**
 * Filtros: el rubro del almacén, armado con la lógica común (rubroStock.js).
 * Acá solo va lo propio del rubro: el modelo, los tipos que ofrece y cómo se lo
 * nombra en los avisos.
 *
 * `campo: "filtro"` es la referencia al artículo adentro del movimiento. Los
 * rubros nuevos la llaman "articulo"; este se queda con el nombre viejo porque
 * ya hay movimientos guardados así en la base.
 */
export const {
  getAll,
  getById,
  create,
  update,
  remove,
  getMovimientos,
  addMovimiento,
  updateMovimiento,
  removeMovimiento,
} = crearRubro({
  Modelo: Filtro,
  Movimiento: MovimientoFiltro,
  TIPOS,
  PREFIJOS,
  campo: "filtro",
  textos: {
    noEncontrado: "Filtro no encontrado",
    repetido: "Ya hay un filtro de esa marca con ese código de fábrica",
    tipoInvalido: "Tipo de filtro inválido",
    eliminado: "Filtro eliminado",
  },
});
