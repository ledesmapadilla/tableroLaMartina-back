import { Router } from "express";
import { getAll, guardar, remove } from "../controllers/admisibles.controller.js";

const router = Router();

router.get("/", getAll);
router.put("/:tarea", guardar);
router.delete("/:tarea", remove);

export default router;
