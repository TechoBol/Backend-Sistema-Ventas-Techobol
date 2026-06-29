import prisma from "../config/db";
import { sendTransferNotification } from "../utils/sendTransferNotification";

export const approvedTransferNotification = async (
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

    if (!transfer) return;

    const employees = await prisma.employee.findMany({
      where: {
        locationId: transfer.toLocationId!,
        isVisible: true,
        email: {
          not: null,
        },
      },
      select: {
        name: true,
        lastName: true,
        email: true,
      },
    });

    if (!employees.length) return;

    const products = transfer.items.map((item) => ({
      code: item.product.code,
      name: item.product.name,
      quantity: item.presentationQuantity ?? item.quantity,
    }));

    await Promise.allSettled(
      employees.map((employee) =>
        sendTransferNotification({
          email: employee.email!,
          employee: `${employee.name} ${employee.lastName}`,
          transferCode: transfer.transferCode ?? "",
          origin: transfer.fromLocation?.name ?? "",
          destination: transfer.toLocation?.name ?? "",
          approvedBy: transfer.approvedBy
            ? `${transfer.approvedBy.name} ${transfer.approvedBy.lastName}`
            : "Sistema",
          products,
        }),
      ),
    );
  } catch (error) {
    console.error(
      "❌ Error en approvedTransferNotification:",
      error,
    );
  }
};