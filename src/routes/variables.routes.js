import { Router } from "express";
import { getAll, getClientes, create, update, remove } from "../controllers/variables.controller.js";

const router = Router();

router.get("/", getAll);
// Va antes de cualquier "/:id" para que no se la coma esa ruta.
router.get("/clientes", getClientes);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
