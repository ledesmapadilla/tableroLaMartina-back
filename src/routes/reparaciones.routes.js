import { Router } from "express";
import { getAll, getByTaller, getById, create, update, remove } from "../controllers/reparaciones.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/taller/:taller", getByTaller);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
