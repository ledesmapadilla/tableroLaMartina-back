import { Router } from "express";
import { getAll, getById, create, update, remove, getResumenReparaciones, getDetalleReparaciones } from "../controllers/camionetas.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/reparaciones/resumen", getResumenReparaciones);
router.get("/:id/reparaciones", getDetalleReparaciones);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
