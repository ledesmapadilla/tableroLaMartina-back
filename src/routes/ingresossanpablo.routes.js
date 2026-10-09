import { Router } from "express";
import {
  getAll,
  create,
  update,
  remove,
  getFrentes,
  createFrente,
  getResponsables,
  saveResponsables,
} from "../controllers/ingresossanpablo.controller.js";
import {
  getChequeos,
  createChequeo,
  updateChequeo,
  removeChequeo,
  agregarRepuesto,
  actualizarRepuesto,
  borrarRepuesto,
  agregarProblema,
  actualizarProblema,
  borrarProblema,
  getGastoReal,
} from "../controllers/chequeossanpablo.controller.js";

const router = Router();

// Los frentes, los responsables y los chequeos, antes de las rutas con :id.
router.get("/frentes", getFrentes);
router.post("/frentes", createFrente);
router.get("/responsables", getResponsables);
router.put("/responsables", saveResponsables);
// Las tablas de los sistemas de Manitous › General y el pedido de repuestos.
router.get("/chequeos", getChequeos);
router.get("/chequeos/real", getGastoReal);
router.post("/chequeos", createChequeo);
router.put("/chequeos/:id", updateChequeo);
router.delete("/chequeos/:id", removeChequeo);
router.post("/chequeos/:id/repuestos", agregarRepuesto);
router.put("/chequeos/:id/repuestos/:repuestoId", actualizarRepuesto);
router.delete("/chequeos/:id/repuestos/:repuestoId", borrarRepuesto);
router.post("/chequeos/:id/problemas", agregarProblema);
router.put("/chequeos/:id/problemas/:problemaId", actualizarProblema);
router.delete("/chequeos/:id/problemas/:problemaId", borrarProblema);

router.get("/", getAll);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
