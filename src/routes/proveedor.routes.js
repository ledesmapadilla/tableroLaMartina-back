import { Router } from "express";
import { getAll, crear, actualizar, borrar } from "../controllers/proveedor.controller.js";

const router = Router();

router.get("/", getAll);
router.post("/", crear);
router.put("/:id", actualizar);
router.delete("/:id", borrar);

export default router;
