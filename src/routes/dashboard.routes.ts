import { Router } from "express";
import { dashboardSummary } from "../controllers/dashboard.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// Ruta general consolidada — /dashboard/general
router.get("/general", verifyToken, dashboardSummary);

// Ruta por sucursal — /dashboard/summary?locationId=5
// o sin parámetro para vista general también
router.get("/summary", verifyToken, dashboardSummary);

export default router;