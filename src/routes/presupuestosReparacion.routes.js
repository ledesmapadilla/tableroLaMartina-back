import { Router } from "express";
import { getAll, getById, crear, actualizar } from "../controllers/presupuestosReparacion.controller.js";

// Quién escribe cada cosa lo dice index.routes.js: mandar a cotizar es del
// taller, cotizar es del analista.
const router = Router();
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", crear);
router.put("/:id", actualizar);

export default router;
