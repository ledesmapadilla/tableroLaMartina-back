import { Router } from "express";
import { getFilas, putFilas, deleteFilas, getEstado } from "../controllers/contable.controller.js";
import {
  getEquivalencias,
  putEquivalencia,
  deleteEquivalencia,
  putEquivalenciaCtv,
  putEquivalenciaCostos,
  postTareaCitrusvil,
  deleteTareaCitrusvil,
  getUnidades,
  putUnidad,
  deleteUnidad,
} from "../controllers/equivalencias.controller.js";
import { gasoil, dolar } from "../controllers/preciosContable.controller.js";
import { escribirSi } from "../middleware/permisos.js";

const router = Router();

// Cada parte de Contable escribe con su permiso (Altas › Usuarios › Roles).
const EXCEL = escribirSi(["contable.excel"]);
const EQUIVALENCIAS = escribirSi(["contable.equivalencias"]);

// La tabla de cada mes de Contable (05/11/2026), armada desde el Excel
// mensual. El Excel no se guarda: solo sus filas. Una tabla no se pisa: para
// subir otro Excel primero se borra.
// Si el mes tiene tabla, sin traer las filas.
router.get("/estado/:anio/:mes", getEstado);
router.get("/filas/:anio/:mes", getFilas);
router.put("/filas/:anio/:mes", EXCEL, putFilas);
router.delete("/filas/:anio/:mes", EXCEL, deleteFilas);

// Equivalencias de tareas (05/11/2026): qué tareas de Citrusvil equivalen a
// cada tarea de La Martina.
router.get("/equivalencias", getEquivalencias);
router.put("/equivalencias/:tareaId", EQUIVALENCIAS, putEquivalencia);
router.delete("/equivalencias/:tareaId", EQUIVALENCIAS, deleteEquivalencia);
// Lo mismo visto desde Citrusvil: con qué tarea de La Martina va cada una.
router.put("/equivalencias-ctv", EQUIVALENCIAS, putEquivalenciaCtv);
// La de una tarea de Citrusvil solo para la Comparativa de costos (07/11/2026).
router.put("/equivalencias-costos", EQUIVALENCIAS, putEquivalenciaCostos);

// Las tareas de Citrusvil agregadas a mano (las demás salen de los Excel).
router.post("/tareas-citrusvil", EQUIVALENCIAS, postTareaCitrusvil);
router.delete("/tareas-citrusvil/:id", EQUIVALENCIAS, deleteTareaCitrusvil);

// Las unidades de Citrusvil que no se reconocían y a cuál de La Martina
// equivalen (08/11/2026). Una unidad nueva del Excel se deja cargar y acá se
// dice a cuál equivale.
router.get("/unidades", getUnidades);
router.put("/unidades", EQUIVALENCIAS, putUnidad);
router.delete("/unidades/:id", EQUIVALENCIAS, deleteUnidad);

// El precio del gasoil y el del dólar con su fecha (07/11/2026), arriba de la
// tabla de Equivalencias tareas/variables. Uno por fecha.
for (const [ruta, c] of [
  ["/gasoil", gasoil],
  ["/dolar", dolar],
]) {
  router.get(ruta, c.getAll);
  router.put(ruta, EQUIVALENCIAS, c.put);
  router.put(`${ruta}/:id`, EQUIVALENCIAS, c.update);
  router.delete(`${ruta}/:id`, EQUIVALENCIAS, c.remove);
}

export default router;
