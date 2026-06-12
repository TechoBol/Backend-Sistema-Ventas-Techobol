import prisma from "../config/db";

export const createTransferRepo = async (data: {
  requestedById: number;
  toLocationId: number;
  fromLocationId?: number;
  items: { productId: number; quantity: number }[];
  glosa: string;
}) => {
  const location = await prisma.location.findUnique({
    where: {
      id: data.toLocationId,
    },
    select: {
      id: true,
      name: true,
      abbreviation: true,
    },
  });

  if (!location) {
    throw new Error("Location no encontrada");
  }

  const lastTransfer = await prisma.transfer.findFirst({
    where: {
      toLocationId: data.toLocationId,
    },
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
    },
  });

  const nextNumber = (lastTransfer?.id || 0) + 1;

  const transferCode = `TR-${location.abbreviation}-${nextNumber}`;

  if (data.fromLocationId) {
    const inventories = await prisma.inventory.findMany({
      where: {
        locationId: data.fromLocationId,
        productId: {
          in: data.items.map((i) => i.productId),
        },
      },
    });

    const inventoryMap = new Map(
      inventories.map((inv) => [inv.productId, inv]),
    );

    for (const item of data.items) {
      const inventory = inventoryMap.get(item.productId);

      if (!inventory) {
        throw new Error(`No existe inventario para producto ${item.productId}`);
      }

      if (inventory.quantity < item.quantity) {
        throw new Error(`Stock insuficiente para producto ${item.productId}`);
      }
    }
  }

  return prisma.transfer.create({
    data: {
      transferCode,
      requestedById: data.requestedById,
      toLocationId: data.toLocationId,
      fromLocationId: data.fromLocationId,
      status: "PENDING",
      glosa: data.glosa,

      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },

    include: {
      fromLocation: true,
      toLocation: true,
      requestedBy: true,

      items: {
        include: {
          product: {
            include: {
              line: true,
            },
          },
        },
      },
    },
  });
};

export const getTransfersByLocationRepo = async () => {
  return prisma.transfer.findMany({
    include: {
      ////////////////////////////////////////
      // 🔥 LOCATIONS
      ////////////////////////////////////////

      fromLocation: true,

      toLocation: true,

      ////////////////////////////////////////
      // 🔥 SOLICITANTE
      ////////////////////////////////////////

      requestedBy: {
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,

          role: {
            select: {
              name: true,
            },
          },
        },
      },

      ////////////////////////////////////////
      // 🔥 APROBADOR
      ////////////////////////////////////////

      approvedBy: {
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,

          role: {
            select: {
              name: true,
            },
          },
        },
      },

      ////////////////////////////////////////
      // 🔥 ITEMS
      ////////////////////////////////////////

      items: {
        include: {
          product: {
            include: {
              line: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

export const approveTransferRepo = async (
  transferId: number,
  approvedById: number,
  fromLocationId: number,
) => {
  return prisma.$transaction(
    async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: {
          id: transferId,
        },
        include: {
          items: true,
          requestedBy: true,
        },
      });

      if (!transfer) {
        throw new Error("Transfer no existe");
      }

      if (transfer.status !== "PENDING") {
        throw new Error("Transfer ya procesada");
      }

      const realFromLocationId = transfer.fromLocationId ?? fromLocationId;

      const toLocationId = transfer.toLocationId;

      if (!toLocationId) {
        throw new Error("Location destino inválida");
      }

      const productIds = transfer.items.map((i) => i.productId);

      const sourceInventories = await tx.inventory.findMany({
        where: {
          locationId: realFromLocationId,
          productId: {
            in: productIds,
          },
        },
      });

      const targetInventories = await tx.inventory.findMany({
        where: {
          locationId: toLocationId,
          productId: {
            in: productIds,
          },
        },
      });

      const sourceMap = new Map(sourceInventories.map((i) => [i.productId, i]));

      const targetMap = new Map(targetInventories.map((i) => [i.productId, i]));

      //////////////////////////////////////
      // VALIDAR STOCK
      //////////////////////////////////////

      for (const item of transfer.items) {
        const sourceInventory = sourceMap.get(item.productId);

        if (!sourceInventory) {
          throw new Error(`Inventario origen no encontrado ${item.productId}`);
        }

        if (sourceInventory.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para producto ${item.productId}`);
        }
      }

      //////////////////////////////////////
      // PROCESAR ITEMS
      //////////////////////////////////////

      for (const item of transfer.items) {
        const sourceInventory = sourceMap.get(item.productId)!;

        const averageCost = sourceInventory.averageCost || 0;

        //////////////////////////////////////
        // DESCONTAR ORIGEN
        //////////////////////////////////////

        await tx.inventory.update({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: realFromLocationId,
            },
          },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });

        //////////////////////////////////////
        // DESTINO
        //////////////////////////////////////

        const targetInventory = targetMap.get(item.productId);

        if (targetInventory) {
          const cantidadActual = targetInventory.quantity;
          const costoActual = targetInventory.averageCost;

          const totalActual = cantidadActual * costoActual;
          const totalNuevo = item.quantity * averageCost;

          const nuevaCantidad = cantidadActual + item.quantity;

          const nuevoPromedio =
            nuevaCantidad > 0
              ? (totalActual + totalNuevo) / nuevaCantidad
              : averageCost;

          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: toLocationId,
              },
            },
            data: {
              quantity: {
                increment: item.quantity,
              },
              averageCost: nuevoPromedio,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              productId: item.productId,
              locationId: toLocationId,
              quantity: item.quantity,
              averageCost,
            },
          });
        }

        //////////////////////////////////////
        // KARDEX
        //////////////////////////////////////

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            fromLocationId: realFromLocationId,
            toLocationId,
            quantity: item.quantity,
            type: "TRANSFER",
            transferId: transfer.id,
            unitCost: averageCost,
            reference: transfer.transferCode,
          },
        });
      }

      //////////////////////////////////////
      // APROBAR TRANSFERENCIA
      //////////////////////////////////////

      const updateData: any = {
        status: "APPROVED",
        approvedById,
        approvedAt: new Date(),
        executedAt: new Date(),
      };

      // Solo asignar origen si la transferencia no tenía uno
      if (!transfer.fromLocationId) {
        updateData.fromLocationId = realFromLocationId;
      }

      await tx.transfer.update({
        where: {
          id: transferId,
        },
        data: updateData,
      });

      return tx.transfer.findUnique({
        where: {
          id: transferId,
        },
        include: {
          fromLocation: true,
          toLocation: true,

          requestedBy: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },

          approvedBy: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },

          items: {
            include: {
              product: true,
            },
          },
        },
      });
    },
    {
      timeout: 15000,
    },
  );
};

export const rejectTransferRepo = async (
  transferId: number,
  approvedById: number,
) => {
  return prisma.transfer.update({
    where: {
      id: transferId,
    },

    data: {
      status: "REJECTED",

      approvedById,

      approvedAt: new Date(),
    },
  });
};
