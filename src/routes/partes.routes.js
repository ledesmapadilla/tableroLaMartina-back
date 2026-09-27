import { Router } from "express";
import {
  getAll,
  getById,
  getUltimoHorometro,
  getClientes,
  getCierresDeLotes,
  getConsumos,
  create,
  update,
  remove,
} from "../controllers/partes.controller.js";

const router = Router();

router.get("/", getAll);
// Va antes de "/:id" para que no se la coma esa ruta.
router.get("/ultimo-horometro/:cc", getUltimoHorometro);
router.get("/clientes", getClientes);
router.get("/cierres-de-lotes", getCierresDeLotes);
router.get("/consumos", getConsumos);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
