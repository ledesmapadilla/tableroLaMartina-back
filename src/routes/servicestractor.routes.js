import { Router } from "express";
import {
  getAll,
  getUltimos,
  getUltimosPorAño,
  getHistorialPorTractor,
  getUltimosHorometros,
  create,
  update,
  eliminar,
} from "../controllers/servicestractor.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
router.get("/ultimos/:año", getUltimosPorAño);
router.get("/historial/:tractorId", getHistorialPorTractor);
router.get("/ultimos-horometros", getUltimosHorometros);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", eliminar);

export default router;
