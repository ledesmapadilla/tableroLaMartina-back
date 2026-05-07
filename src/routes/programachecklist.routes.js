import { Router } from "express";
import { getByAño, upsertEstado, getTareasPendientesCount, deleteByAño } from "../controllers/programachecklist.controller.js";

const router = Router();

router.get("/tareas-pendientes/count", getTareasPendientesCount);
router.get("/:año", getByAño);
router.post("/", upsertEstado);
router.delete("/:camionetaId/:año", deleteByAño);

export default router;
