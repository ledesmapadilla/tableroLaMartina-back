import { Router } from "express";
import { listar, crear, eliminar } from "../controllers/visitas.controller.js";

const router = Router();

router.get("/", listar);
router.post("/", crear);
router.delete("/:id", eliminar);

export default router;
