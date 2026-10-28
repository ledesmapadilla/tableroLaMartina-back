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
  getReparacionesCarros,
  saveReparacionCarro,
  removeReparacionCarro,
  getFechaLimiteEscaleras,
  saveFechaLimiteEscaleras,
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
  getEstadosIngreso,
  saveEstadoIngreso,
  getEstadosManitou,
  saveEstadoManitou,
  getPesosManitou,
  savePesosManitou,
  getFechaLimiteManitou,
  saveFechaLimiteManitou,
} from "../controllers/chequeossanpablo.controller.js";

const router = Router();

// Los frentes, los responsables y los chequeos, antes de las rutas con :id.
router.get("/frentes", getFrentes);
router.post("/frentes", createFrente);
router.get("/responsables", getResponsables);
router.put("/responsables", saveResponsables);
// La reparación de cada carro porta escaleras, por cosecha (28/10/2026).
router.get("/reparaciones-carros", getReparacionesCarros);
router.put("/reparaciones-carros", saveReparacionCarro);
router.delete("/reparaciones-carros/:id", removeReparacionCarro);
// La fecha límite de cada solapa de la reparación, por cosecha (28/10/2026).
router.get("/fecha-limite-escaleras", getFechaLimiteEscaleras);
router.put("/fecha-limite-escaleras", saveFechaLimiteEscaleras);
// Las tablas de los sistemas de Manitous › General y el pedido de repuestos.
// El estado de ingreso de cada sistema de una Manitou (10/10/2026).
router.get("/estado-ingreso", getEstadosIngreso);
router.put("/estado-ingreso", saveEstadoIngreso);
// En reparación o en espera, por Manitou y cosecha (11/10/2026).
router.get("/estado-manitou", getEstadosManitou);
router.put("/estado-manitou", saveEstadoManitou);
// Cuánto pesa cada sistema en la reparación, cargado en General (21/10/2026).
router.get("/pesos-manitou", getPesosManitou);
router.put("/pesos-manitou", savePesosManitou);
// Para cuándo tienen que estar reparadas, por cosecha (28/10/2026).
router.get("/fecha-limite-manitou", getFechaLimiteManitou);
router.put("/fecha-limite-manitou", saveFechaLimiteManitou);
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
