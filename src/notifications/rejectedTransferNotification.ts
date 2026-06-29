import prisma from "../config/db";
import { sendTransferRejectedNotification } from "../utils/sendTransferRejectedNotification";

export const rejectedTransferNotification = async (
  transferId: number,
) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: {
        id: transferId,
      },
      include: {
        fromLocation: true,
        toLocation: true,
        approvedBy: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    console.log(transfer)
    if (!transfer) return;

    const employees = await prisma.employee.findMany({
      where: {
        isVisible: true,
        email: {
          not: null,
        },
        OR: [
          {
            locationId: transfer.fromLocationId!,
          },
          {
            locationId: transfer.toLocationId!,
          },
        ],
      },
      select: {
        name: true,
        lastName: true,
        email: true,
      },
    });

    const uniqueEmployees = [
      ...new Map(
        employees.map((e) => [e.email, e]),
      ).values(),
    ];

    const products = transfer.items.map((item) => ({
      code: item.product.code,
      name: item.product.name,
      quantity:
        item.presentationQuantity ??
        item.quantity,
    }));

    for (const employee of uniqueEmployees) {
      try {
        await sendTransferRejectedNotification({
          email: employee.email!,
          employee: `${employee.name} ${employee.lastName}`,
          transferCode: transfer.transferCode ?? "",
          origin: transfer.fromLocation?.name ?? "",
          destination: transfer.toLocation?.name ?? "",
          rejectedBy: transfer.approvedBy
            ? `${transfer.approvedBy.name} ${transfer.approvedBy.lastName}`
            : "Sistema",
          reason:
            transfer.rejectionReason ??
            "Sin motivo especificado",
          products,
        });

        console.log(
          `✅ Correo de rechazo enviado a ${employee.email}`,
        );
      } catch (error) {
        console.error(
          `❌ Error enviando correo a ${employee.email}`,
          error,
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Error rejectedTransferNotification:",
      error,
    );
  }
};