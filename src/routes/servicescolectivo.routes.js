import { Router } from "express";
import {
  getAll,
  getUltimos,
  getUltimosPorAño,
  getHistorialPorColectivo,
  getUltimosKilometrajes,
  create,
  update,
  eliminar,
} from "../controllers/servicescolectivo.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/ultimos", getUltimos);
router.get("/ultimos/:año", getUltimosPorAño);
router.get("/historial/:colectivoId", getHistorialPorColectivo);
router.get("/ultimos-kilometrajes", getUltimosKilometrajes);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", eliminar);

export default router;
