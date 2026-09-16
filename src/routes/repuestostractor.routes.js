import { Router } from "express";
import { getAll, guardar } from "../controllers/repuestostractor.controller.js";

const router = Router();

router.get("/", getAll);
router.put("/:tractorId", guardar);

export default router;
