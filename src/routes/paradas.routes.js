import { Router } from "express";
import { getAbiertasCount, getPorCamioneta, crear, actualizar, eliminar } from "../controllers/paradas.controller.js";

const router = Router();

router.get("/abiertas/count", getAbiertasCount);
router.get("/:camionetaId", getPorCamioneta);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", eliminar);

export default router;
