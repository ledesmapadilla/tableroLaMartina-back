import { Router } from "express";
import { getPendientesIds, getPorCamioneta, crear, actualizar, eliminar } from "../controllers/trabajoscamioneta.controller.js";

const router = Router();

router.get("/pendientes/ids", getPendientesIds);
router.get("/:camionetaId", getPorCamioneta);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;
