import { Router } from "express";
import { dashboardSummary } from "../controllers/dashboard.controller";

const router = Router();

router.get("/summary", dashboardSummary);

export default router;