import { Router } from "express";
import { getByAño, upsertEstado } from "../controllers/programachecklist.controller.js";

const router = Router();

router.get("/:año", getByAño);
router.post("/", upsertEstado);

export default router;
