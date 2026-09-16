import { Router } from "express";
import { getAll, getById, update } from "../controllers/tractores.controller.js";

const router = Router();

// Sin alta ni baja: se hacen en Centros de costo (/centros-costo).
router.get("/", getAll);
router.get("/:id", getById);
router.put("/:id", update);

export default router;
