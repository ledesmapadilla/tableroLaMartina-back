import { Router } from "express";
import { getDelPeriodo, guardar } from "../controllers/descuentos.controller.js";

const router = Router();

router.get("/:anio/:mes", getDelPeriodo);
router.put("/:anio/:mes/:persona", guardar);

export default router;
