import { Router } from "express";
import {
  getAll,
  create,
  update,
  remove,
  getFrentes,
  createFrente,
} from "../controllers/ingresossanpablo.controller.js";

const router = Router();

// Los frentes, antes de las rutas con :id.
router.get("/frentes", getFrentes);
router.post("/frentes", createFrente);

router.get("/", getAll);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
