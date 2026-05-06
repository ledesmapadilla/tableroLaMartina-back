import { Router } from "express";
import { getPorCamioneta, crear, actualizar, eliminar } from "../controllers/trabajoscamioneta.controller.js";

const router = Router();

router.get("/:camionetaId", getPorCamioneta);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;
