import { Router } from "express";
import camionetasRouter from "./camionetas.routes.js";
import tractoresRouter from "./tractores.routes.js";
import reparacionesRouter from "./reparaciones.routes.js";
import checklistRouter from "./checklist.routes.js";
import programaChecklistRouter from "./programachecklist.routes.js";
import kilometrosRouter from "./kilometros.routes.js";
import servicesRouter from "./services.routes.js";
import paradasRouter from "./paradas.routes.js";
import trabajosCamionetaRouter from "./trabajoscamioneta.routes.js";
import cronRouter from "./cron.routes.js";
import configRouter from "./config.routes.js";

const router = Router();

router.get("/", (req, res) => res.json({ message: "API funcionando" }));
router.use("/camionetas", camionetasRouter);
router.use("/tractores", tractoresRouter);
router.use("/reparaciones", reparacionesRouter);
router.use("/checklist", checklistRouter);
router.use("/programa-checklist", programaChecklistRouter);
router.use("/kilometros", kilometrosRouter);
router.use("/services", servicesRouter);
router.use("/paradas", paradasRouter);
router.use("/trabajos-camioneta", trabajosCamionetaRouter);
router.use("/cron", cronRouter);
router.use("/config", configRouter);

export default router;
