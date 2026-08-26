import { Router } from "express";
import {
  getAll,
  getHistorialPorTractor,
  eliminar,
} from "../controllers/historialtractor.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/:tractorId", getHistorialPorTractor);
router.delete("/registro/:id", eliminar);

export default router;
