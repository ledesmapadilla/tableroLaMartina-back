import { Router } from "express";
import { getAll, getById, create, update, remove, previaRenombre } from "../controllers/centroscosto.controller.js";

const router = Router();

router.get("/", getAll);
// Qué se reescribe si el CC pasa a llamarse ?cc=… (no guarda nada).
router.get("/:id/renombre", previaRenombre);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
