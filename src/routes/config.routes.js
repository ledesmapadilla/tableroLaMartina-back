import { Router } from "express";
import { getConfig, updateConfig, updateMontoAutorizacion } from "../controllers/config.controller.js";
import { soloRoles } from "../middleware/auth.js";
import { escribirSi } from "../middleware/permisos.js";

const router = Router();

router.get("/", getConfig);
// La config general la cambia Último service de camionetas (el teléfono de
// aviso): pide editar esa pantalla en la tabla de Roles.
router.put("/", escribirSi(["camionetas.ultimoService"]), updateConfig);
// El monto de autorización de Compras: solo gerente y superadmin.
router.put("/monto-autorizacion", soloRoles("gerente", "superadmin"), updateMontoAutorizacion);

export default router;
