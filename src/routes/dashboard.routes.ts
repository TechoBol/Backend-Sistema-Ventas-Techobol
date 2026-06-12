import { Router } from "express";
import { dashboardSummary } from "../controllers/dashboard.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

router.get("/summary", verifyToken, dashboardSummary);

export default router;