import { Router } from "express";
import { getAll, getUno, getResumen } from "../controllers/registro.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/resumen", getResumen);
router.get("/:id", getUno);

export default router;
