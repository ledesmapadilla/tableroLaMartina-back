import { Router } from "express";
import { getAll, getUltimos, getResumenPorAño, create } from "../controllers/services.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
router.get("/resumen/:año", getResumenPorAño);
router.post("/", create);

export default router;
