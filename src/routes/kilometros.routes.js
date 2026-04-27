import { Router } from "express";
import { getAll, getUltimos, getPorAño, getResumenPorAño, create, update, remove } from "../controllers/kilometros.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
router.get("/por-año/:año", getPorAño);
router.get("/resumen/:año", getResumenPorAño);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
