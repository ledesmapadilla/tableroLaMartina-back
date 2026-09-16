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
import repuestosTractorRouter from "./repuestostractor.routes.js";
import centrosCostoRouter from "./centroscosto.routes.js";
import personalRouter from "./personal.routes.js";
import tareasRouter from "./tareas.routes.js";
import partesRouter from "./partes.routes.js";
import periodosRouter from "./periodos.routes.js";
import variablesRouter from "./variables.routes.js";
import descuentosRouter from "./descuentos.routes.js";
import cambiosRouter from "./cambios.routes.js";
import pendientesRouter from "./pendientes.routes.js";
import ingresosSanPabloRouter from "./ingresossanpablo.routes.js";

// Compras. Se unifico con el Tablero el 06/09/2026: comparten base, padron de
// centros de costo y, mas adelante, login. Ninguna de estas rutas choca con
// las de arriba; los centros de costo son la unica ruta comun y la sirve el
// controlador del Tablero, que ya maneja el padron unificado.
import authRouter from "./auth.routes.js";
import usuariosRouter from "./usuario.routes.js";
import proveedoresRouter from "./proveedor.routes.js";
import berdinaPedidosRouter from "./berdinaPedido.routes.js";
import sanPabloPedidosRouter from "./sanPabloPedido.routes.js";
import opRouter from "./op.routes.js";
import rolesRouter from "./roles.routes.js";
import { verificarToken, soloRoles } from "../middleware/auth.js";
import { escribirSi } from "../middleware/permisos.js";

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

/**
 * Quién escribe en cada recurso, según la tabla de Roles (Altas › Usuarios ›
 * Roles): escribirSi() deja pasar las lecturas y a crear, modificar o borrar
 * le pide "Editar" en alguna de esas pantallas. Las claves están en
 * permisos/catalogo.js. Lo que no lleva escribirSi (auth, cron, visitas,
 * pendientes de la reunión) sigue como antes.
 */
const CAMIONETA_TAREAS = ["camionetas.tareas"];
const TRACTOR_TAREAS = ["tractores.tareas"];

router.use("/auth", authRouter);
router.use("/camionetas", escribirSi(["altas.camionetas", "camionetas.ultimoService"]), camionetasRouter);
router.use("/tractores", escribirSi(["altas.tractores"]), tractoresRouter);
router.use("/colectivos", escribirSi(["altas.colectivos"]), colectivosRouter);
router.use(
  "/reparaciones",
  escribirSi(["camionetas.reportar", "camionetas.tareas", "tractores.reportar", "tractores.tareas"]),
  reparacionesRouter
);
router.use("/checklist", escribirSi(["camionetas.checklist"]), checklistRouter);
router.use("/programa-checklist", escribirSi(["camionetas.checklist"]), programaChecklistRouter);
router.use("/kilometros", escribirSi(["camionetas.kilometros"]), kilometrosRouter);
router.use("/services", escribirSi(["camionetas.ultimoService"]), servicesRouter);
router.use("/services-tractor", escribirSi(["tractores.preventivo"]), servicesTractorRouter);
// El horómetro se carga desde el preventivo, al reportar una falla, en las
// tareas, en la planilla de certificación y en Visitas.
router.use(
  "/horometros-tractor",
  escribirSi([
    "tractores.preventivo",
    "tractores.reportar",
    "tractores.tareas",
    "produccion.certificacion",
    "mantenimiento.visitas",
  ]),
  horometrosTractorRouter
);
router.use("/services-colectivo", escribirSi(["colectivos.preventivo"]), servicesColectivoRouter);
router.use("/kilometros-colectivo", escribirSi(["colectivos.preventivo"]), kilometrosColectivoRouter);
router.use("/historial-tractor", escribirSi(["altas.tractores"]), historialTractorRouter);
router.use("/repuestos-tractor", escribirSi(["tractores.repuestos"]), repuestosTractorRouter);
router.use(
  "/paradas",
  escribirSi(["camionetas.checklist", "camionetas.tareas", "camionetas.reportar"]),
  paradasRouter
);
// Reportar falla crea la tarea; Tareas la modifica; se borra desde Tareas, el
// Historial, la Planilla general y el check list.
router.use(
  "/trabajos-camioneta",
  escribirSi({
    POST: ["camionetas.reportar", "camionetas.checklist"],
    PUT: CAMIONETA_TAREAS,
    PATCH: CAMIONETA_TAREAS,
    DELETE: ["camionetas.tareas", "camionetas.historial", "camionetas.planilla", "camionetas.checklist"],
  }),
  trabajosCamionetaRouter
);
router.use(
  "/trabajos-tractor",
  escribirSi({
    POST: ["tractores.reportar"],
    PUT: TRACTOR_TAREAS,
    PATCH: TRACTOR_TAREAS,
    DELETE: ["tractores.tareas", "tractores.historial", "tractores.planilla"],
  }),
  trabajosTractorRouter
);
router.use("/cron", cronRouter);
// El control de config va ruta por ruta en config.routes.js: el monto de
// autorización tiene su propia regla.
router.use("/config", configRouter);
router.use("/visitas", visitasRouter);
router.use("/centros-costo", escribirSi(["altas.centrosCosto"]), centrosCostoRouter);
router.use("/personal", escribirSi(["altas.personal"]), personalRouter);
router.use("/tareas", escribirSi(["altas.tareas"]), tareasRouter);
router.use("/partes", escribirSi(["produccion.certificacion"]), partesRouter);
router.use("/periodos", escribirSi(["produccion.certificacion"]), periodosRouter);
router.use("/variables", escribirSi(["produccion.variables"]), variablesRouter);
router.use("/descuentos", escribirSi(["produccion.contable"]), descuentosRouter);
router.use("/cambios", escribirSi(["produccion.contable"]), cambiosRouter);
router.use("/pendientes", pendientesRouter);
// Ingresos al taller de San Pablo (Manitous y las demás tarjetas).
router.use("/ingresos-sanpablo", escribirSi(["sanpablo.ingresos"]), ingresosSanPabloRouter);

// ── Compras ──
// Usuarios es solo del superadmin, también para leer: la lista trae las
// contraseñas.
router.use("/usuarios", soloRoles("superadmin"), usuariosRouter);
router.use("/proveedores", escribirSi(["altas.proveedores"]), proveedoresRouter);
// El pedido lo crea y lo borra el taller; los ítems los cambian el taller, el
// analista, el comprador (OP, retiro) y Gerencia.
const PEDIDOS = {
  POST: ["compras.pedidos"],
  PUT: ["compras.pedidos", "compras.analista", "compras.comprador", "compras.gerencia"],
  DELETE: ["compras.pedidos"],
};
router.use("/berdina/pedidos", escribirSi(PEDIDOS), berdinaPedidosRouter);
router.use("/sanpablo/pedidos", escribirSi(PEDIDOS), sanPabloPedidosRouter);
router.use("/op", escribirSi(["compras.comprador"]), opRouter);

// Qué ve y qué edita cada rol (Altas › Usuarios › Roles).
router.use("/roles", rolesRouter);

export default router;
