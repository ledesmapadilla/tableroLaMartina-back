import { Router } from "express";
import {
  getAll,
  getHistorialPorColectivo,
  create,
  update,
  eliminar,
} from "../controllers/kilometroscolectivo.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/historial/:colectivoId", getHistorialPorColectivo);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", eliminar);

export default router;
