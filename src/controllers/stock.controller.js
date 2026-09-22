import { RUBROS, RUBROS_POR_DESCRIPCION } from "../catalogos/almacen.js";
import { crearModelosRubro } from "../models/rubroStock.js";
import Filtro from "../models/Filtro.js";
import { crearRubro } from "./rubroStock.js";

/**
 * Los rubros del almacén que se dan de alta por descripción (22/09/2026).
 *
 * Todos son iguales: mismo esquema, misma lógica, lo único propio es la
 * colección y el prefijo del código. Así que salen de una vuelta sobre el
 * catálogo en vez de tener un modelo, un controlador y un router copiados seis
 * veces.
 *
 * Los mensajes hablan de "artículo" y no del rubro: un rubro junta cosas
 * distintas —en Cubiertas y correas hay baterías— y decirle cubierta a una
 * batería confundiría al que lo lee.
 */
const TEXTOS = {
  noEncontrado: "Artículo no encontrado",
  repetido: "Ya hay un artículo de esa marca con ese código de fábrica",
  descripcionVacia: "La descripción es requerida",
  eliminado: "Artículo eliminado",
};

// Clave del rubro → su modelo de artículos. Se va llenando abajo y de acá sale
// el catálogo general.
const MODELOS = { filtros: Filtro };

// Clave del rubro → sus handlers. Importar este archivo registra de paso los
// modelos, que es de donde los toma `npm run indexes`.
export const RUBROS_STOCK = Object.fromEntries(
  RUBROS_POR_DESCRIPCION.map(({ rubro, modelo, prefijo, aCargo }) => {
    const { Articulo, Movimiento, Asignacion } = crearModelosRubro({ rubro, modelo, aCargo });
    MODELOS[rubro] = Articulo;
    return [
      rubro,
      crearRubro({ Modelo: Articulo, Movimiento, Asignacion, PREFIJO: prefijo, textos: TEXTOS }),
    ];
  })
);

/**
 * El catálogo general: todo el almacén en una sola lista (22/09/2026).
 *
 * No es un rubro más, es todo lo que existe junto, para buscar un repuesto sin
 * saber de antemano en qué tarjeta lo cargaron. Es solo de lectura: dar de alta,
 * mover la existencia o prestar se sigue haciendo en el rubro.
 *
 * Cada fila dice de qué rubro salió. El nombre viene siempre en `descripcion`
 * aunque el rubro lo guarde como `tipo` —es el caso de Filtros—, así la tabla
 * de adelante no tiene que saber cuál es cuál.
 */
export const getCatalogo = async (req, res) => {
  try {
    // En el orden del catálogo, que es el de las tarjetas del stock.
    const rubros = Object.keys(RUBROS).filter((rubro) => MODELOS[rubro]);

    const porRubro = await Promise.all(
      rubros.map((rubro) =>
        MODELOS[rubro]
          .find()
          .select("codigo tipo descripcion marca codigoFabrica existencia ubicacion observaciones")
          .sort({ codigo: 1 })
          .lean()
      )
    );

    const articulos = porRubro.flatMap((lista, i) =>
      lista.map(({ tipo, ...a }) => ({ ...a, rubro: rubros[i], descripcion: a.descripcion || tipo }))
    );
    res.json(articulos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
