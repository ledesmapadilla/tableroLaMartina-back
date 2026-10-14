import { Router } from "express";
import { getConfig, updateMontoAutorizacion } from "../controllers/config.controller.js";
import { soloRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", getConfig);
// El monto de autorización de Compras: solo gerente y superadmin.
router.put("/monto-autorizacion", soloRoles("gerente", "superadmin"), updateMontoAutorizacion);

export default router;
