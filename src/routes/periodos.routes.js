import { Router } from "express";
import {
  getPeriodo,
  getPeriodosDelAnio,
  guardarPeriodo,
} from "../controllers/periodos.controller.js";

const router = Router();

router.get("/:anio", getPeriodosDelAnio);
router.get("/:anio/:mes", getPeriodo);
router.put("/:anio/:mes", guardarPeriodo);

export default router;
