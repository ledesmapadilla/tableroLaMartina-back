import { Router } from "express";
import { getAll, getById, crear, cancelar, actualizar, borrar } from "../controllers/presupuestosReparacion.controller.js";

// Quién escribe cada cosa lo dice index.routes.js: mandar a cotizar es del
// taller, cotizar es del analista. Cancelar va por POST porque es del taller.
const router = Router();
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", crear);
router.post("/:id/cancelar", cancelar);
router.put("/:id", actualizar);
router.delete("/:id", borrar);

export default router;
