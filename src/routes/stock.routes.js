import { Router } from "express";
import { RUBROS_STOCK, getCatalogo } from "../controllers/stock.controller.js";
import * as filtros from "../controllers/filtros.controller.js";
import * as aceites from "../controllers/aceites.controller.js";

/**
 * El almacén de repuestos, por rubro (22/09/2026).
 *
 * Cada rubro cuelga de su clave (`/stock/cubiertas`, `/stock/ferreteria`…) y
 * todos tienen las mismas rutas: el catálogo del rubro y, colgando de cada
 * artículo, sus entradas y salidas. El permiso lo pone el barril, que monta
 * todo esto con `escribirSi(["compras.stock"])`.
 */
const rutasDe = (handlers) => {
  const router = Router();
  router.get("/", handlers.getAll);
  // Las entradas y salidas van antes de /:id: si no, "movimientos" entra como
  // id.
  router.get("/:id/movimientos", handlers.getMovimientos);
  router.post("/:id/movimientos", handlers.addMovimiento);
  router.put("/:id/movimientos/:movId", handlers.updateMovimiento);
  router.delete("/:id/movimientos/:movId", handlers.removeMovimiento);
  // A cargo de quién está: solo en los rubros que se prestan en vez de
  // consumirse, que hoy es Herramientas.
  if (handlers.getAsignaciones) {
    router.get("/:id/acargo", handlers.getAsignaciones);
    router.post("/:id/acargo", handlers.entregar);
    router.put("/:id/acargo/devolver", handlers.devolver);
  }
  router.get("/:id", handlers.getById);
  router.post("/", handlers.create);
  router.put("/:id", handlers.update);
  router.delete("/:id", handlers.remove);
  return router;
};

const router = Router();

// El catálogo general no es un rubro: es todo el almacén junto y solo de
// lectura. Va primero, pero no se pisa con nada porque cada rubro cuelga de su
// propia clave.
router.get("/catalogo", getCatalogo);

// Los aceites no son un rubro: se cuentan en litros y sus movimientos son
// compras y consumos, con otros datos (28/09/2026). Cuelgan de /stock para
// llevar el mismo permiso que el resto del almacén.
const rutasAceites = Router();
rutasAceites.get("/", aceites.getAll);
rutasAceites.post("/", aceites.create);
// Todos los movimientos juntos: va antes de /:id para que "movimientos" no
// entre como id.
rutasAceites.get("/movimientos", aceites.getMovimientos);
rutasAceites.post("/:id/movimientos", aceites.addMovimiento);
rutasAceites.put("/:id/movimientos/:movId", aceites.updateMovimiento);
rutasAceites.delete("/:id/movimientos/:movId", aceites.removeMovimiento);
rutasAceites.put("/:id", aceites.update);
rutasAceites.delete("/:id", aceites.remove);
router.use("/aceites", rutasAceites);

// Filtros va aparte: es el único que se da de alta eligiendo el tipo de una
// lista, y sus movimientos guardan la referencia con el nombre viejo.
router.use("/filtros", rutasDe(filtros));

for (const [rubro, handlers] of Object.entries(RUBROS_STOCK)) {
  router.use(`/${rubro}`, rutasDe(handlers));
}

export default router;
