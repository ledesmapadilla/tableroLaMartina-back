import { Router } from "express";
import { getDelPeriodo, create, update, remove } from "../controllers/cambios.controller.js";

const router = Router();

router.get("/:anio/:mes", getDelPeriodo);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
