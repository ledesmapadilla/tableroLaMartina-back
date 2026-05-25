import { Router } from "express";
import { checkServices } from "../controllers/cron.controller.js";

const router = Router();

router.get("/check-services", checkServices);

export default router;
