import { Router } from "express";
import {
  getAll,
  getById,
  getUltimoHorometro,
  getClientes,
  create,
  update,
  setTerminado,
  remove,
} from "../controllers/partes.controller.js";

const router = Router();

router.get("/", getAll);
// Va antes de "/:id" para que no se la coma esa ruta.
router.get("/ultimo-horometro/:cc", getUltimoHorometro);
router.get("/clientes", getClientes);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.put("/:id/terminado", setTerminado);
router.delete("/:id", remove);

export default router;
