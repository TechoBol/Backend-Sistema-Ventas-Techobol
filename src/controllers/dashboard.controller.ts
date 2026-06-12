// dashboard.controller.ts — sin AuthRequest, Request ya tiene user
import { Request, Response } from "express";
import { getDashboardSummary } from "../repository/dashboard.repository";

const CAN_SWITCH_BRANCH = [1, 2, 5];
const FIXED_BRANCH_LEVEL = 3;
const NO_DASHBOARD_LEVEL = 4;

export const dashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    if (user.level === NO_DASHBOARD_LEVEL) {
      res.status(403).json({ message: "No tienes acceso al dashboard" });
      return;
    }

    let locationId: number | undefined;

    if (user.level === FIXED_BRANCH_LEVEL) {
      locationId = user.locationId ?? undefined;
    } else if (CAN_SWITCH_BRANCH.includes(user.level)) {
      const queryLocation = req.query.locationId;
      locationId = queryLocation ? Number(queryLocation) : undefined;
    }

    const data = await getDashboardSummary(locationId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo dashboard" });
  }
};