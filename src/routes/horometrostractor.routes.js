import { Router } from "express";
import {
  getAll,
  getHistorialPorTractor,
  create,
  update,
  eliminar,
} from "../controllers/horometrostractor.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/historial/:tractorId", getHistorialPorTractor);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", eliminar);

export default router;
