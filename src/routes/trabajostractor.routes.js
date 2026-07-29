import { Router } from "express";
import { getAll, getPendientesIds, getParadosIds, getById, getPorTractor, crear, actualizar, eliminar } from "../controllers/trabajostractor.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/pendientes/ids", getPendientesIds);
router.get("/parados/ids", getParadosIds);
router.get("/tractor/:tractorId", getPorTractor);
router.get("/:id", getById);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;
