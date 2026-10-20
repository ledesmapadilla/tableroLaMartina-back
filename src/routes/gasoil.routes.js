import { Router } from "express";
import {
  getAll,
  getDetalle,
  guardar,
  remove,
  getIngresos,
  crearIngreso,
  editarIngreso,
  borrarIngreso,
  getAuditorias,
  pedirAuditoria,
  cargarAuditoria,
  borrarAuditoria,
  fotoAuditoria,
  getAuditoriasPendientes,
} from "../controllers/gasoil.controller.js";

const router = Router();

// La planilla de consumos (?campo=), con el saldo calculado.
router.get("/", getAll);
// Los partes de un día con combustible (?campo=&fecha=AAAA-MM-DD).
router.get("/detalle", getDetalle);
// Observaciones de un día: crea o pisa (campo + fecha en el cuerpo).
router.put("/", guardar);

// Los ingresos de gasoil al tanque (?campo=). Van antes de "/:id".
router.get("/ingresos", getIngresos);
router.post("/ingresos", crearIngreso);
router.put("/ingresos/:id", editarIngreso);
router.delete("/ingresos/:id", borrarIngreso);

// Auditorías: el pedido y lo que carga cada encargado (litros + foto del
// nivel) en su campo. También antes de "/:id".
router.get("/auditorias", getAuditorias);
// Las que esperan la foto, por campo: el triángulo de Producción.
router.get("/auditorias/pendientes", getAuditoriasPendientes);
router.post("/auditorias", pedirAuditoria);
router.put("/auditorias/:id/:campo", cargarAuditoria);
router.put("/auditorias/:id/:campo/foto", fotoAuditoria);
router.delete("/auditorias/:id", borrarAuditoria);

router.delete("/:id", remove);

export default router;
