import { Router } from "express";
import { getPeriodo, guardarPeriodo } from "../controllers/periodos.controller.js";

const router = Router();

router.get("/:anio/:mes", getPeriodo);
router.put("/:anio/:mes", guardarPeriodo);

export default router;
