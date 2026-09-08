import { Router } from "express";
import camionetasRouter from "./camionetas.routes.js";
import tractoresRouter from "./tractores.routes.js";
import colectivosRouter from "./colectivos.routes.js";
import reparacionesRouter from "./reparaciones.routes.js";
import checklistRouter from "./checklist.routes.js";
import programaChecklistRouter from "./programachecklist.routes.js";
import kilometrosRouter from "./kilometros.routes.js";
import servicesRouter from "./services.routes.js";
import paradasRouter from "./paradas.routes.js";
import trabajosCamionetaRouter from "./trabajoscamioneta.routes.js";
import trabajosTractorRouter from "./trabajostractor.routes.js";
import cronRouter from "./cron.routes.js";
import configRouter from "./config.routes.js";
import visitasRouter from "./visitas.routes.js";
import servicesTractorRouter from "./servicestractor.routes.js";
import horometrosTractorRouter from "./horometrostractor.routes.js";
import servicesColectivoRouter from "./servicescolectivo.routes.js";
import kilometrosColectivoRouter from "./kilometroscolectivo.routes.js";
import historialTractorRouter from "./historialtractor.routes.js";
import centrosCostoRouter from "./centroscosto.routes.js";
import personalRouter from "./personal.routes.js";
import tareasRouter from "./tareas.routes.js";
import partesRouter from "./partes.routes.js";
import periodosRouter from "./periodos.routes.js";
import variablesRouter from "./variables.routes.js";
import descuentosRouter from "./descuentos.routes.js";
import cambiosRouter from "./cambios.routes.js";
import pendientesRouter from "./pendientes.routes.js";

// Compras. Se unifico con el Tablero el 06/09/2026: comparten base, padron de
// centros de costo y, mas adelante, login. Ninguna de estas rutas choca con
// las de arriba; los centros de costo son la unica ruta comun y la sirve el
// controlador del Tablero, que ya maneja el padron unificado.
import authRouter from "./auth.routes.js";
import usuariosRouter from "./usuario.routes.js";
import proveedoresRouter from "./proveedor.routes.js";
import berdinaPedidosRouter from "./berdinaPedido.routes.js";
import sanPabloPedidosRouter from "./sanPabloPedido.routes.js";
import ocRouter from "./oc.routes.js";
import { verificarToken } from "../middleware/auth.js";

const router = Router();

router.get("/", (req, res) => res.json({ message: "API funcionando" }));

/**
 * Todo pide token menos lo que este listado aca.
 *
 * Va antes de montar los routers, asi una ruta nueva queda protegida sola sin
 * que nadie tenga que acordarse.
 *
 *  - /auth      el login.
 *  - /visitas   la vista del celular de la entrada: la usa quien controla el
 *               ingreso, que no tiene usuario.
 *  - GET /tractores  de ahi saca Visitas las patentes. Solo lectura: crear o
 *               editar un tractor sigue pidiendo token.
 *  - /cron      lo llama Vercel todos los dias a las 11; no hay nadie que
 *               inicie sesion del otro lado.
 */
const ES_PUBLICO = [
  (req) => req.path.startsWith("/auth"),
  (req) => req.path.startsWith("/visitas"),
  (req) => req.method === "GET" && req.path === "/tractores",
  (req) => req.path.startsWith("/cron"),
];

router.use((req, res, next) =>
  ES_PUBLICO.some((esPublico) => esPublico(req)) ? next() : verificarToken(req, res, next)
);

router.use("/auth", authRouter);
router.use("/camionetas", camionetasRouter);
router.use("/tractores", tractoresRouter);
router.use("/colectivos", colectivosRouter);
router.use("/reparaciones", reparacionesRouter);
router.use("/checklist", checklistRouter);
router.use("/programa-checklist", programaChecklistRouter);
router.use("/kilometros", kilometrosRouter);
router.use("/services", servicesRouter);
router.use("/services-tractor", servicesTractorRouter);
router.use("/horometros-tractor", horometrosTractorRouter);
router.use("/services-colectivo", servicesColectivoRouter);
router.use("/kilometros-colectivo", kilometrosColectivoRouter);
router.use("/historial-tractor", historialTractorRouter);
router.use("/paradas", paradasRouter);
router.use("/trabajos-camioneta", trabajosCamionetaRouter);
router.use("/trabajos-tractor", trabajosTractorRouter);
router.use("/cron", cronRouter);
router.use("/config", configRouter);
router.use("/visitas", visitasRouter);
router.use("/centros-costo", centrosCostoRouter);
router.use("/personal", personalRouter);
router.use("/tareas", tareasRouter);
router.use("/partes", partesRouter);
router.use("/periodos", periodosRouter);
router.use("/variables", variablesRouter);
router.use("/descuentos", descuentosRouter);
router.use("/cambios", cambiosRouter);
router.use("/pendientes", pendientesRouter);

// ── Compras ──
router.use("/usuarios", usuariosRouter);
router.use("/proveedores", proveedoresRouter);
router.use("/berdina/pedidos", berdinaPedidosRouter);
router.use("/sanpablo/pedidos", sanPabloPedidosRouter);
router.use("/oc", ocRouter);

export default router;
