import cron from "node-cron";
import prisma from "../config/db";
import { notificationRepository } from "../repository/notification.repository";

export const startExpireQuotationsJob = () => {
  // Corre cada hora — ajusta la expresión si necesitas más frecuencia
  // Cada 15 min: "*/15 * * * *"
  // Cada hora:   "0 * * * *"
  cron.schedule("0 * * * *", async () => {
    try {
      // 1️⃣ Buscar las cotizaciones que vencieron para notificarlas
      const expiring = await prisma.quotation.findMany({
        where: {
          status: "PENDING",
          expiresAt: { lt: new Date() },
        },
        select: { id: true, code: true, locationId: true },
      });

      if (expiring.length === 0) return;

      // 2️⃣ Marcarlas como EXPIRED
      const result = await prisma.quotation.updateMany({
        where: {
          status: "PENDING",
          expiresAt: { lt: new Date() },
        },
        data: { status: "EXPIRED" },
      });

      console.log(`✅ [CRON] ${result.count} cotización(es) marcada(s) como EXPIRED`);

      // 3️⃣ Crear notificación por cada una
      for (const q of expiring) {
        try {
          await notificationRepository.createForAll({
            type: "QUOTATION",
            title: "Cotización vencida",
            body: `La cotización ${q.code} ha vencido`,
            quotationId: q.id,
            locationId: q.locationId,
          });
        } catch (notifError) {
          console.error(`❌ [CRON] Error notificando cotización ${q.code}:`, notifError);
        }
      }
    } catch (error) {
      console.error("❌ [CRON] Error al expirar cotizaciones:", error);
    }
  });

  console.log("🕐 [CRON] Job de expiración de cotizaciones iniciado (cada hora)");
};