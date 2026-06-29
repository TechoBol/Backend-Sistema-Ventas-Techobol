import prisma from "../config/db";
import { sendTransferRequestNotification } from "../utils/sendTransferRequestNotification";

export const requestedTransferNotification = async (
  transferId: number,
) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: {
        id: transferId,
      },
      include: {
        requestedBy: true,
        fromLocation: true,
        toLocation: true,
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
    locationId: transfer.fromLocationId!,
    isVisible: true,
    email: {
      not: null,
    },
    role: {
      name: {
        notIn: [
          "Técnico en sistemas",
          "Gerente General",
          "Gerente Operaciones",
          "Subgerente Tecnico",
          "Auditor Interno",
        ],
      },
    },
  },
  select: {
    name: true,
    lastName: true,
    email: true,
  },
});

    const products = transfer.items.map((item) => ({
      code: item.product.code,
      name: item.product.name,
      quantity: item.presentationQuantity ?? item.quantity,
    }));

    for (const employee of employees) {
      try {
        await sendTransferRequestNotification({
          email: employee.email!,
          employee: `${employee.name} ${employee.lastName}`,
          transferCode: transfer.transferCode ?? "",
          requestedBy: `${transfer.requestedBy.name} ${transfer.requestedBy.lastName}`,
          origin: transfer.fromLocation?.name ?? "",
          destination: transfer.toLocation?.name ?? "",
          products,
        });

        console.log(`✅ Correo enviado a ${employee.email}`);
      } catch (err) {
        console.error(`Error enviando a ${employee.email}`, err);
      }
    }
  } catch (err) {
    console.error("Error requestedTransferNotification:", err);
  }
};