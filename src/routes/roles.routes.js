import { Router } from "express";
import { soloRoles } from "../middleware/auth.js";
import { getAll, getMio, update } from "../controllers/roles.controller.js";

const router = Router();

// Los propios los pide cualquiera que esté logueado; ver y cambiar los de
// todos los roles es solo del superadmin.
router.get("/mio", getMio);
router.get("/", soloRoles("superadmin"), getAll);
router.put("/:rol", soloRoles("superadmin"), update);

export default router;
