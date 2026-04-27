import { Router } from "express";
import { getAll, getByCamioneta, getById, getByMesAño, create, update, remove } from "../controllers/checklist.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/buscar", getByMesAño);
router.get("/camioneta/:camionetaId", getByCamioneta);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
