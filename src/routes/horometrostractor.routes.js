import { Router } from "express";
import {
  getAll,
  getHistorialPorTractor,
  create,
  update,
  eliminar,
  validar,
  crearCambio,
  getCambios,
  getHorasAcumuladas,
} from "../controllers/horometrostractor.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/historial/:tractorId", getHistorialPorTractor);

// Regla del horómetro. Van antes de "/:id" para que no las capture esa ruta.
router.post("/validar", validar);
router.post("/cambio", crearCambio);
router.get("/cambios/:tractorId", getCambios);
router.get("/acumuladas/:tractorId", getHorasAcumuladas);

router.post("/", create);
router.put("/:id", update);
router.delete("/:id", eliminar);

export default router;
