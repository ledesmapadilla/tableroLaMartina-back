import { Router } from "express";
import { getAll, getUltimos, getUltimosPorAño, getResumenPorAño, create, update } from "../controllers/services.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
router.get("/ultimos/:año", getUltimosPorAño);
router.get("/resumen/:año", getResumenPorAño);
router.post("/", create);
router.put("/:id", update);

export default router;
