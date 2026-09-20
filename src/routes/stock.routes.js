import { Router } from "express";
import {
  getAll,
  crear,
  actualizar,
  borrar,
  getMovimientos,
  registrarMovimiento,
} from "../controllers/stock.controller.js";

const router = Router();

/**
 * El stock del almacén. Quién puede escribir lo controla index.routes.js con
 * `escribirSi(["compras.stock"])`: por ahora lo lleva el analista, y cuando
 * cada taller tenga el suyo se sumará su clave.
 */
router.get("/", getAll);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", borrar);

// El saldo solo se mueve por acá.
router.get("/:id/movimientos", getMovimientos);
router.post("/:id/movimientos", registrarMovimiento);

export default router;
