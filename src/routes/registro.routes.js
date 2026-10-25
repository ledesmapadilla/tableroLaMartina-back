import { Router } from "express";
import { getAll, getUno } from "../controllers/registro.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/:id", getUno);

export default router;
