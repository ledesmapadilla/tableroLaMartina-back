import { Router } from "express";
import { getAll, getById, update, getResumenReparaciones, getDetalleReparaciones } from "../controllers/camionetas.controller.js";

const router = Router();

// Sin alta ni baja: se hacen en Centros de costo (/centros-costo).
router.get("/", getAll);
router.get("/reparaciones/resumen", getResumenReparaciones);
router.get("/:id/reparaciones", getDetalleReparaciones);
router.get("/:id", getById);
router.put("/:id", update);

export default router;
