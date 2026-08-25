import { Router } from "express";
import { getAll, getUltimos, getPorAño, getResumenPorAño, create, update, remove } from "../controllers/kilometros.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
// El path va en ASCII: Express matchea contra la URL percent-encoded, asi que
// una "n" con virgulilla en el segmento literal no matchea nunca (daba 404).
router.get("/anio/:año", getPorAño);
router.get("/resumen/:año", getResumenPorAño);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
