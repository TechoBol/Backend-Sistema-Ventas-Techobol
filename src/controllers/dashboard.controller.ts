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
      // Nivel 3: siempre ve solo su sucursal, ignorar query params
      locationId = user.locationId ?? undefined;

    } else if (CAN_SWITCH_BRANCH.includes(user.level)) {
      const queryLocation = req.query.locationId;

      if (!queryLocation || queryLocation === "general") {
        // Sin filtro → vista general consolidada
        locationId = undefined;
      } else {
        locationId = Number(queryLocation);

        if (isNaN(locationId)) {
          res.status(400).json({ message: "locationId inválido" });
          return;
        }
      }
    }

    const data = await getDashboardSummary(locationId);

    // Indicar en la respuesta si es vista general o de sucursal
    res.json({
      ...data,
      meta: {
        isGeneral: locationId === undefined,
        locationId: locationId ?? null,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo dashboard" });
  }
};