import { Router } from "express";
import { listar, crear, quitarCC, eliminar } from "../controllers/visitas.controller.js";

const router = Router();

router.get("/", listar);
router.post("/", crear);
router.patch("/:id/quitar-cc", quitarCC);
router.delete("/:id", eliminar);

export default router;
