import prisma from "../config/db";
import { sendTransferEditedNotification } from "../utils/sendTransferEditedNotification";

export const editedTransferNotification = async (
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
        editedBy: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transfer) return;

    console.log("Motivo:", transfer.editReason);

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
      quantity: item.presentationQuantity ?? item.quantity,
    }));

    for (const employee of uniqueEmployees) {
      try {
        await sendTransferEditedNotification({
          email: employee.email!,
          employee: `${employee.name} ${employee.lastName}`,
          transferCode: transfer.transferCode ?? "",
          origin: transfer.fromLocation?.name ?? "",
          destination: transfer.toLocation?.name ?? "",
          editedBy: transfer.editedBy
            ? `${transfer.editedBy.name} ${transfer.editedBy.lastName}`
            : "Sistema",
          reason: transfer.editReason,
          products,
        });

        console.log(
          `✅ Correo de modificación enviado a ${employee.email}`,
        );
      } catch (error) {
        console.error(
          `❌ Error enviando correo a ${employee.email}`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error editedTransferNotification:", error);
  }
};