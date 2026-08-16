import { Router } from "express";
import { getAll, getPendientesIds, getById, getPorCamioneta, crear, actualizar, eliminar } from "../controllers/trabajoscamioneta.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/pendientes/ids", getPendientesIds);
router.get("/tarea/:id", getById);
router.get("/camioneta/:camionetaId", getPorCamioneta);
router.get("/:camionetaId", getPorCamioneta);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;
