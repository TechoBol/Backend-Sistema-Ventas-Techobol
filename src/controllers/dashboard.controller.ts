import { Request, Response } from "express";
import { getDashboardSummary } from "../repository/dashboard.repository";

export const dashboardSummary = async (_req: Request, res: Response) => {
  try {
    const data = await getDashboardSummary();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo dashboard",
    });
  }
};