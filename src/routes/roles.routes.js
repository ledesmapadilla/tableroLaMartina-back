import { Router } from "express";
import { soloRoles } from "../middleware/auth.js";
import { create, getAll, getMio, remove, update } from "../controllers/roles.controller.js";

const router = Router();

// Los propios los pide cualquiera que esté logueado; ver y cambiar los de
// todos los roles es solo del superadmin.
router.get("/mio", getMio);
router.get("/", soloRoles("superadmin"), getAll);
router.put("/:rol", soloRoles("superadmin"), update);
// Los roles nuevos (07/11/2026): crearlos desde Altas › Usuarios › Nuevo rol y
// borrarlos desde Roles, si no tienen usuarios.
router.post("/", soloRoles("superadmin"), create);
router.delete("/:rol", soloRoles("superadmin"), remove);

export default router;
